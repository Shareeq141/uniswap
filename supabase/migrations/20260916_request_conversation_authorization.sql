-- Enforce pending contact-request creation and accepted-request conversations.
-- This is a forward-only production hardening migration.
BEGIN;

-- New contact requests must be pending, must belong to the authenticated
-- requester, and must target the actual owner of an available listing.
DROP POLICY IF EXISTS "Users can create contact requests" ON public.contact_requests;
CREATE POLICY "Users can create contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND status = 'pending'
    AND requester_id <> owner_id
    AND EXISTS (
      SELECT 1
      FROM public.listings AS listing
      WHERE listing.id = contact_requests.listing_id
        AND listing.owner_id = contact_requests.owner_id
        AND listing.status = 'available'
    )
  );

DROP POLICY IF EXISTS "Owners can update request status" ON public.contact_requests;
CREATE POLICY "Owners can update request status"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND status IN ('pending', 'accepted', 'declined')
  );

CREATE OR REPLACE FUNCTION public.validate_contact_request_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  listing_owner UUID;
  listing_status TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'New contact requests must start as pending';
  END IF;

  SELECT owner_id, status
  INTO listing_owner, listing_status
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

-- Direct conversation inserts are restricted to the same accepted-request
-- relationship enforced by the RPC below.
DROP POLICY IF EXISTS "Participants can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can create accepted-request conversations" ON public.conversations;
CREATE POLICY "Participants can create accepted-request conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    (auth.uid() = participant_one OR auth.uid() = participant_two)
    AND listing_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.contact_requests AS request
      WHERE request.listing_id = conversations.listing_id
        AND request.status = 'accepted'
        AND (
          (request.requester_id = conversations.participant_one AND request.owner_id = conversations.participant_two)
          OR (request.requester_id = conversations.participant_two AND request.owner_id = conversations.participant_one)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.validate_conversation_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.participant_one = NEW.participant_two THEN
    RAISE EXCEPTION 'A conversation requires two distinct participants';
  END IF;

  IF NEW.listing_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.contact_requests AS request
    WHERE request.listing_id = NEW.listing_id
      AND request.status = 'accepted'
      AND (
        (request.requester_id = NEW.participant_one AND request.owner_id = NEW.participant_two)
        OR (request.requester_id = NEW.participant_two AND request.owner_id = NEW.participant_one)
      )
  ) THEN
    RAISE EXCEPTION 'Conversation requires a matching accepted contact request';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_conversation_request ON public.conversations;
CREATE TRIGGER validate_conversation_request
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_conversation_request();

CREATE OR REPLACE FUNCTION public.create_or_get_conversation_for_request(
  p_request_id UUID
)
RETURNS TABLE (
  id UUID,
  listing_id UUID,
  participant_one UUID,
  participant_two UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  request_row RECORD;
  conversation_row public.conversations%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT request.listing_id, request.requester_id, request.owner_id
  INTO request_row
  FROM public.contact_requests AS request
  WHERE request.id = p_request_id
    AND request.status = 'accepted'
    AND (
      request.requester_id = current_user_id
      OR request.owner_id = current_user_id
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accepted contact request not found or access denied';
  END IF;

  INSERT INTO public.conversations (
    listing_id,
    participant_one,
    participant_two
  )
  VALUES (
    request_row.listing_id,
    request_row.owner_id,
    request_row.requester_id
  )
  ON CONFLICT DO NOTHING;

  SELECT conversation.*
  INTO conversation_row
  FROM public.conversations AS conversation
  WHERE conversation.listing_id = request_row.listing_id
    AND (
      (
        conversation.participant_one = request_row.owner_id
        AND conversation.participant_two = request_row.requester_id
      )
      OR (
        conversation.participant_one = request_row.requester_id
        AND conversation.participant_two = request_row.owner_id
      )
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation could not be created';
  END IF;

  RETURN QUERY
  SELECT
    conversation_row.id,
    conversation_row.listing_id,
    conversation_row.participant_one,
    conversation_row.participant_two,
    conversation_row.created_at,
    conversation_row.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_get_conversation_for_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_get_conversation_for_request(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
