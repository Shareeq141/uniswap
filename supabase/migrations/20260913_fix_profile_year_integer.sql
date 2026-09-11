-- Fix the existing owner-only profile update RPC so the integer
-- profiles.year_of_study column receives an integer parameter.
BEGIN;

-- PostgreSQL cannot change a function argument type with CREATE OR REPLACE.
-- Replace only the old TEXT-signature overload; the RPC name and security
-- boundary remain the same.
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_campus TEXT,
  p_department TEXT,
  p_year_of_study INTEGER,
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
      roll_number = NULLIF(BTRIM(p_roll_number), '')
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
