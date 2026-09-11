-- Extend the existing profile row with editable student details.
-- Reuses the existing listing-images Storage bucket; profile images are stored
-- beneath the authenticated user's existing folder and remain permanent URLs.
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS year_of_study TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_number TEXT;

-- Roll numbers must not be readable or writable through ordinary public
-- PostgREST column access. The owner-only functions below handle this data.
REVOKE SELECT (roll_number) ON public.profiles FROM anon, authenticated;
REVOKE INSERT (roll_number) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (roll_number) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS TABLE (roll_number TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.roll_number
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_private_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_campus TEXT,
  p_department TEXT,
  p_year_of_study TEXT,
  p_bio TEXT,
  p_avatar_url TEXT,
  p_roll_number TEXT
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
    OR length(COALESCE(p_year_of_study, '')) > 40
    OR length(COALESCE(p_bio, '')) > 1000
    OR length(COALESCE(p_roll_number, '')) > 64 THEN
    RAISE EXCEPTION 'One or more profile fields are too long';
  END IF;

  UPDATE public.profiles
  SET full_name = NULLIF(BTRIM(p_full_name), ''),
      first_name = NULLIF(BTRIM(p_first_name), ''),
      last_name = NULLIF(BTRIM(p_last_name), ''),
      campus = NULLIF(BTRIM(p_campus), ''),
      department = NULLIF(BTRIM(p_department), ''),
      year_of_study = NULLIF(BTRIM(p_year_of_study), ''),
      bio = NULLIF(BTRIM(p_bio), ''),
      avatar_url = NULLIF(BTRIM(p_avatar_url), ''),
      roll_number = NULLIF(BTRIM(p_roll_number), ''),
      updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
