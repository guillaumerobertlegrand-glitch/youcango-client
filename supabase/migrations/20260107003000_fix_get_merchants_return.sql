-- FIX GET MERCHANTS RPC
-- The frontend needs 'location_id' to create a session, but the RPC wasn't returning it.

DROP FUNCTION IF EXISTS api_v1_get_merchants(double precision, double precision, text, text[], integer);

CREATE OR REPLACE FUNCTION api_v1_get_merchants(
    p_lat DOUBLE PRECISION,
    p_long DOUBLE PRECISION,
    p_category TEXT DEFAULT NULL,
    p_keywords TEXT[] DEFAULT '{}',
    p_radius_meters INTEGER DEFAULT 5000
)
RETURNS TABLE (
    id UUID, -- Organization ID
    location_id UUID, -- Location ID (NEW)
    name TEXT,
    business_type TEXT,
    category TEXT,
    address TEXT,
    lat DOUBLE PRECISION,
    long DOUBLE PRECISION,
    dist_meters DOUBLE PRECISION
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        l.id AS location_id, -- Returning the Location ID
        o.name,
        o.business_type,
        o.category,
        l.address,
        ST_Y(l.coordinates::geometry) AS lat,
        ST_X(l.coordinates::geometry) AS long,
        ST_Distance(l.coordinates, ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography) AS dist_meters
    FROM 
        public.organizations o
    JOIN 
        public.locations l ON l.organization_id = o.id
    WHERE 
        ST_Distance(l.coordinates, ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography) <= p_radius_meters
        AND (p_category IS NULL OR o.business_type = p_category)
        AND (
            p_keywords = '{}' 
            OR EXISTS (
                SELECT 1 FROM unnest(p_keywords) kw 
                WHERE o.name ILIKE '%' || kw || '%' OR o.category ILIKE '%' || kw || '%'
            )
        )
    ORDER BY 
        dist_meters ASC;
END;
$$;
