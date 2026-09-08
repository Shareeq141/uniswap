-- UniSwap forward migration: college search and browser-location support.
-- Safe for existing projects: no tables or existing rows are removed.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS college_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Preserve the old campus value for listings created before college_name existed.
UPDATE public.listings
SET college_name = campus
WHERE college_name IS NULL
  AND NULLIF(BTRIM(campus), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_college_name_trgm_idx
  ON public.listings USING gin (college_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_title_trgm_idx
  ON public.listings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_description_trgm_idx
  ON public.listings USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_campus_trgm_idx
  ON public.listings USING gin (campus gin_trgm_ops);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_nearby_listings(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 1.5
)
RETURNS SETOF public.listings
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_listings(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;

COMMIT;
