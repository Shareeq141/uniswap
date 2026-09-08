-- Private, user-owned wishlist entries for marketplace listings.
BEGIN;

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wishlist_items_user_listing_key UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS wishlist_items_user_created_idx
  ON public.wishlist_items (user_id, created_at DESC);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wishlist" ON public.wishlist_items;
CREATE POLICY "Users can view their own wishlist"
  ON public.wishlist_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to their own wishlist" ON public.wishlist_items;
CREATE POLICY "Users can add to their own wishlist"
  ON public.wishlist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from their own wishlist" ON public.wishlist_items;
CREATE POLICY "Users can remove from their own wishlist"
  ON public.wishlist_items FOR DELETE
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
COMMIT;
