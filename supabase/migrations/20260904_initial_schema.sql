-- ==============================================================================
-- UNISWAP DATABASE SCHEMA & MIGRATIONS
-- Safe, idempotent script for UniSwap student marketplace
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  campus TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Public profiles are viewable by everyone"
      ON public.profiles FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Automatic profile creation trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'first_name' || ' ' || new.raw_user_meta_data->>'last_name', 'Student'),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    full_name = EXCLUDED.full_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. LISTINGS TABLE
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  exchange_type TEXT NOT NULL DEFAULT 'Give Away',
  type TEXT,
  swap_want TEXT,
  campus TEXT,
  college_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  images TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all required columns exist in listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS exchange_type TEXT NOT NULL DEFAULT 'Give Away';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS swap_want TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS campus TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS college_name TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available';
ALTER TABLE public.listings ALTER COLUMN status SET DEFAULT 'available';

UPDATE public.listings
SET college_name = campus
WHERE college_name IS NULL
  AND NULLIF(BTRIM(campus), '') IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS listings_college_name_trgm_idx
  ON public.listings USING gin (college_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_title_trgm_idx
  ON public.listings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_description_trgm_idx
  ON public.listings USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_campus_trgm_idx
  ON public.listings USING gin (campus gin_trgm_ops);

-- Enable RLS on listings
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Listings Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listings' AND policyname = 'Listings are viewable by everyone'
  ) THEN
    CREATE POLICY "Listings are viewable by everyone"
      ON public.listings FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listings' AND policyname = 'Users can create listings'
  ) THEN
    CREATE POLICY "Users can create listings"
      ON public.listings FOR INSERT
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listings' AND policyname = 'Users can update their own listings'
  ) THEN
    CREATE POLICY "Users can update their own listings"
      ON public.listings FOR UPDATE
      USING (auth.uid() = owner_id)
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listings' AND policyname = 'Users can delete their own listings'
  ) THEN
    CREATE POLICY "Users can delete their own listings"
      ON public.listings FOR DELETE
      USING (auth.uid() = owner_id);
  END IF;
END $$;


-- 3. CONTACT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'Give Away',
  offered_item TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  request_seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist in contact_requests
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'Give Away';
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS offered_item TEXT;
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS request_seen BOOLEAN NOT NULL DEFAULT false;

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

-- Enable RLS on contact_requests
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Contact Requests Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contact_requests' AND policyname = 'Users can view their incoming or outgoing requests'
  ) THEN
    CREATE POLICY "Users can view their incoming or outgoing requests"
      ON public.contact_requests FOR SELECT
      USING (auth.uid() = requester_id OR auth.uid() = owner_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contact_requests' AND policyname = 'Users can create contact requests'
  ) THEN
    CREATE POLICY "Users can create contact requests"
      ON public.contact_requests FOR INSERT
      WITH CHECK (auth.uid() = requester_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contact_requests' AND policyname = 'Owners can update request status'
  ) THEN
    CREATE POLICY "Owners can update request status"
      ON public.contact_requests FOR UPDATE
      USING (auth.uid() = owner_id)
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

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


-- 4. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  participant_one UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_listing_participants_idx
  ON public.conversations (
    listing_id,
    LEAST(participant_one, participant_two),
    GREATEST(participant_one, participant_two)
  )
  WHERE listing_id IS NOT NULL;

-- Conversations Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Participants can view their conversations'
  ) THEN
    CREATE POLICY "Participants can view their conversations"
      ON public.conversations FOR SELECT
      USING (auth.uid() = participant_one OR auth.uid() = participant_two);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Participants can insert conversations'
  ) THEN
    CREATE POLICY "Participants can insert conversations"
      ON public.conversations FOR INSERT
      WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);
  END IF;
END $$;


-- 5. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure is_read column exists
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can view messages'
  ) THEN
    CREATE POLICY "Participants can view messages"
      ON public.messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
          AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can insert messages'
  ) THEN
    CREATE POLICY "Participants can insert messages"
      ON public.messages FOR INSERT
      WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = conversation_id
          AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can mark incoming messages as read'
  ) THEN
    CREATE POLICY "Participants can mark incoming messages as read"
      ON public.messages FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
          AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
          AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
        )
      );
  END IF;
END $$;

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


-- 6. UNREAD COUNT RPC FUNCTION
CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS INTEGER AS $$
DECLARE
  unread_total INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO unread_total
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    AND m.sender_id != auth.uid()
    AND m.is_read = false;

  RETURN COALESCE(unread_total, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;



-- 7. NEARBY LISTINGS RPC FUNCTION (1.5 KM default)
CREATE OR REPLACE FUNCTION public.get_nearby_listings(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 1.5
)
RETURNS SETOF public.listings AS $$
BEGIN
  IF user_lat IS NULL OR user_lon IS NULL OR radius_km IS NULL
    OR user_lat < -90 OR user_lat > 90
    OR user_lon < -180 OR user_lon > 180
    OR radius_km <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.listings
  WHERE status = 'available'
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(user_lat)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(user_lon)) +
          sin(radians(user_lat)) * sin(radians(latitude))
        ))
      )
    ) <= radius_km
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_nearby_listings(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;


-- 8. STORAGE BUCKET & POLICIES FOR LISTING IMAGES
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Listing images are publicly accessible'
  ) THEN
    CREATE POLICY "Listing images are publicly accessible"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'listing-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload listing images'
  ) THEN
      CREATE POLICY "Authenticated users can upload listing images"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'listing-images'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can update or delete own listing images'
  ) THEN
    CREATE POLICY "Users can update or delete own listing images"
      ON storage.objects FOR ALL
      USING (bucket_id = 'listing-images' AND auth.uid() = owner);
  END IF;
END $$;

-- 9. ENABLE REALTIME
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_requests;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
