-- Migration: Fix api_v1_get_merchants RPC column reference
-- Description: Updates RPC to use 'label_full' instead of 'label' from config_specialties table.

CREATE OR REPLACE FUNCTION api_v1_get_merchants(
    p_lat DOUBLE PRECISION,
    p_long DOUBLE PRECISION,
    p_category TEXT DEFAULT NULL,
    p_keywords TEXT[] DEFAULT '{}',
    p_radius_meters INTEGER DEFAULT 5000,
    p_viewer_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    location_id UUID,
    name TEXT,
    business_type TEXT,
    category TEXT,
    specialty_label TEXT,
    address TEXT,
    lat DOUBLE PRECISION,
    long DOUBLE PRECISION,
    dist_meters DOUBLE PRECISION,
    phone TEXT,
    image_url TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        l.id AS location_id,
        o.name,
        o.business_type,
        o.category,
        cs.label_full AS specialty_label, -- UPDATED: label -> label_full
        l.address,
        ST_Y(l.coordinates::geometry) AS lat,
        ST_X(l.coordinates::geometry) AS long,
        ST_Distance(l.coordinates, ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography) AS dist_meters,
        o.phone,
        o.image_url
    FROM 
        public.organizations o
    JOIN 
        public.locations l ON l.organization_id = o.id
    LEFT JOIN
        public.config_specialties cs ON o.specialty_id = cs.id
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
