-- Production hardening for request targets, request mutation, and message read updates.
-- Safe to run after the initial schema and 20260907_request_seen.sql.
BEGIN;

-- The application and nearby-listings RPC use the canonical available status.
ALTER TABLE public.listings
  ALTER COLUMN status SET DEFAULT 'available';

-- A requester may only create a request for the listing's actual owner and may
-- not request their own listing. The client cannot be trusted for either value.
CREATE OR REPLACE FUNCTION public.validate_contact_request_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_owner UUID;
  listing_status TEXT;
BEGIN
  SELECT owner_id, status INTO listing_owner, listing_status
  FROM public.listings
  WHERE id = NEW.listing_id;

  IF listing_owner IS NULL OR listing_owner IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Contact request owner does not match the listing owner';
  END IF;

  IF listing_status IS DISTINCT FROM 'available' THEN
    RAISE EXCEPTION 'Contact requests are only allowed for available listings';
  END IF;

  IF NEW.requester_id = NEW.owner_id THEN
    RAISE EXCEPTION 'Listing owners cannot request their own listing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_contact_request_target ON public.contact_requests;
CREATE TRIGGER validate_contact_request_target
  BEFORE INSERT ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_contact_request_target();

-- Request content and identity are immutable after creation. Owners may only
-- change status and request_seen through the existing owner update policy.
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
    OR NEW.request_type IS DISTINCT FROM OLD.request_type
    OR NEW.offered_item IS DISTINCT FROM OLD.offered_item
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Contact request identity and offer fields cannot be changed';
  END IF;

  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only pending contact requests can change status';
  END IF;

  IF NEW.status NOT IN ('pending', 'accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid contact request status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_contact_request_identity_change ON public.contact_requests;
CREATE TRIGGER prevent_contact_request_identity_change
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_contact_request_identity_change();

-- Replace the broad insert policy with one that also validates the target at
-- the RLS boundary. The trigger above remains the authoritative race-safe check.
DROP POLICY IF EXISTS "Users can view their incoming or outgoing requests" ON public.contact_requests;
CREATE POLICY "Users can view their incoming or outgoing requests"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create contact requests" ON public.contact_requests;
CREATE POLICY "Users can create contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND requester_id <> owner_id
    AND EXISTS (
      SELECT 1
      FROM public.listings listing
      WHERE listing.id = contact_requests.listing_id
        AND listing.owner_id = contact_requests.owner_id
        AND listing.status = 'available'
    )
  );

DROP POLICY IF EXISTS "Owners can update request status" ON public.contact_requests;
CREATE POLICY "Owners can update request status"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- A participant can read messages, but only the recipient can mark an incoming
-- message read. The trigger still prevents content/sender/conversation edits.
DROP POLICY IF EXISTS "Participants can mark incoming messages as read" ON public.messages;
CREATE POLICY "Participants can mark incoming messages as read"
  ON public.messages FOR UPDATE
  USING (
    auth.uid() <> sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations conversation
      WHERE conversation.id = messages.conversation_id
        AND (conversation.participant_one = auth.uid() OR conversation.participant_two = auth.uid())
    )
  )
  WITH CHECK (
    is_read = true
    AND auth.uid() <> sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations conversation
      WHERE conversation.id = messages.conversation_id
        AND (conversation.participant_one = auth.uid() OR conversation.participant_two = auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
