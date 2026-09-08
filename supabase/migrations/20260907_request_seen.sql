-- Persist whether an incoming contact request has been viewed by its owner.
-- Safe and idempotent for existing projects.
BEGIN;

ALTER TABLE public.contact_requests
  ADD COLUMN IF NOT EXISTS request_seen BOOLEAN NOT NULL DEFAULT false;

-- Normalize projects where an earlier version created the column without
-- the default or NOT NULL constraint.
UPDATE public.contact_requests
SET request_seen = false
WHERE request_seen IS NULL;

ALTER TABLE public.contact_requests
  ALTER COLUMN request_seen SET DEFAULT false,
  ALTER COLUMN request_seen SET NOT NULL;

CREATE INDEX IF NOT EXISTS contact_requests_owner_pending_unseen_idx
  ON public.contact_requests (owner_id)
  WHERE status = 'pending' AND request_seen = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.contact_requests
    WHERE status = 'pending'
    GROUP BY listing_id, requester_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS contact_requests_pending_unique_idx
      ON public.contact_requests (listing_id, requester_id)
      WHERE status = 'pending';
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated users can upload listing images" ON storage.objects;
CREATE POLICY "Authenticated users can upload listing images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.prevent_contact_request_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id
    OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Contact request identity fields cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_contact_request_identity_change ON public.contact_requests;
CREATE TRIGGER prevent_contact_request_identity_change
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_contact_request_identity_change();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_pending_contact_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' AND EXISTS (
    SELECT 1
    FROM public.contact_requests existing_request
    WHERE existing_request.listing_id = NEW.listing_id
      AND existing_request.requester_id = NEW.requester_id
      AND existing_request.status = 'pending'
      AND existing_request.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'A pending request already exists for this listing'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_pending_contact_request ON public.contact_requests;
CREATE TRIGGER prevent_duplicate_pending_contact_request
  BEFORE INSERT OR UPDATE OF listing_id, requester_id, status
  ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_pending_contact_request();

CREATE OR REPLACE FUNCTION public.prevent_message_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.is_read AND NOT NEW.is_read)
    OR (NEW.sender_id = auth.uid()) THEN
    RAISE EXCEPTION 'Messages can only be marked read by the recipient';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_message_mutation ON public.messages;
CREATE TRIGGER prevent_message_mutation
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_mutation();

NOTIFY pgrst, 'reload schema';

COMMIT;
