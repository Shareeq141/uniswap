-- Keep the nearby-listings RPC aligned with the published listing status.
-- The browser still supplies one-time coordinates and the radius remains 1.5 km.
BEGIN;

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
  SELECT listing.*
  FROM public.listings AS listing
  WHERE listing.status = 'available'
    AND listing.latitude IS NOT NULL
    AND listing.longitude IS NOT NULL
    AND listing.latitude BETWEEN -90 AND 90
    AND listing.longitude BETWEEN -180 AND 180
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(user_lat)) * cos(radians(listing.latitude)) *
          cos(radians(listing.longitude) - radians(user_lon)) +
          sin(radians(user_lat)) * sin(radians(listing.latitude))
        ))
      )
    ) <= radius_km
  ORDER BY listing.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_listings(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
