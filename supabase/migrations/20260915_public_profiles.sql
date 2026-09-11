-- Add explicit public roll-number visibility and a safe public profile RPC.
-- Public profile reads never expose roll_number unless the owner opted in.
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_roll_number BOOLEAN;
UPDATE public.profiles SET show_roll_number = false WHERE show_roll_number IS NULL;
ALTER TABLE public.profiles ALTER COLUMN show_roll_number SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN show_roll_number SET NOT NULL;

-- Replace the existing owner-only RPC signature so the visibility setting is
-- saved atomically with the other editable profile fields.
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_campus TEXT,
  p_department TEXT,
  p_year_of_study INTEGER,
  p_bio TEXT,
  p_avatar_url TEXT,
  p_roll_number TEXT,
  p_show_roll_number BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF length(COALESCE(p_full_name, '')) > 160
    OR length(COALESCE(p_campus, '')) > 150
    OR length(COALESCE(p_department, '')) > 150
    OR (p_year_of_study IS NOT NULL AND (p_year_of_study < 1 OR p_year_of_study > 5))
    OR length(COALESCE(p_bio, '')) > 1000
    OR length(COALESCE(p_roll_number, '')) > 64 THEN
    RAISE EXCEPTION 'One or more profile fields are too long or invalid';
  END IF;

  UPDATE public.profiles
  SET full_name = NULLIF(BTRIM(p_full_name), ''),
      first_name = NULLIF(BTRIM(p_first_name), ''),
      last_name = NULLIF(BTRIM(p_last_name), ''),
      campus = NULLIF(BTRIM(p_campus), ''),
      department = NULLIF(BTRIM(p_department), ''),
      year_of_study = p_year_of_study,
      bio = NULLIF(BTRIM(p_bio), ''),
      avatar_url = NULLIF(BTRIM(p_avatar_url), ''),
      roll_number = NULLIF(BTRIM(p_roll_number), ''),
      show_roll_number = COALESCE(p_show_roll_number, false)
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_profile(p_profile_id UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  campus TEXT,
  department TEXT,
  year_of_study INTEGER,
  bio TEXT,
  roll_number TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         p.first_name,
         p.last_name,
         p.full_name,
         p.avatar_url,
         p.campus,
         p.department,
         p.year_of_study,
         p.bio,
         CASE WHEN p.show_roll_number THEN p.roll_number ELSE NULL END,
         p.created_at
  FROM public.profiles AS p
  WHERE p.id = p_profile_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
