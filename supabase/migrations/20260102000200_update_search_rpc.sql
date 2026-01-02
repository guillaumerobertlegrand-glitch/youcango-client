-- Assouplissement du filtrage pour éviter les mismatches de langue (ex: hairdresser vs coiffeur)
CREATE OR REPLACE FUNCTION api_v1_get_merchants(
    p_lat DOUBLE PRECISION,
    p_long DOUBLE PRECISION,
    p_category TEXT DEFAULT NULL,
    p_keywords TEXT[] DEFAULT '{}',
    p_radius_meters INTEGER DEFAULT 10000 -- Rayon augmenté par défaut
)
RETURNS TABLE (
    id UUID,
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
        -- Proximity filter
        ST_Distance(l.coordinates, ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography) <= p_radius_meters
        -- AI Intent Filter: Category (Optional if keywords specified)
        AND (
            p_category IS NULL 
            OR o.business_type = p_category 
            OR p_keywords = '{}'
        )
        -- AI Intent Filter: Keywords OR category matching
        AND (
            p_keywords = '{}' 
            OR EXISTS (
                SELECT 1 FROM unnest(p_keywords) kw 
                WHERE o.name ILIKE '%' || kw || '%' 
                   OR o.category ILIKE '%' || kw || '%'
                   OR (p_category IS NOT NULL AND o.business_type = p_category)
            )
        )
    ORDER BY 
        dist_meters ASC;
END;
$$;

-- Ajout de données de test plus variées pour Paris
INSERT INTO public.organizations (name, business_type, category) VALUES 
('Coiffeur du Marais', 'service', 'hairdresser'),
('Boulangerie Paul', 'merchant', 'bakery'),
('Urgences Dentaires', 'service', 'dentist'),
('Pharmacie de Garde', 'merchant', 'pharmacy');

-- Placement de ces commerçants autour du point par défaut (Paris centre)
INSERT INTO public.locations (organization_id, name, address, coordinates) 
SELECT id, 'Paris Shop', 'Île de la Cité', ST_SetSRID(ST_MakePoint(2.3522 + (random()*0.01 - 0.005), 48.8566 + (random()*0.01 - 0.005)), 4326)::geography 
FROM public.organizations
WHERE name IN ('Coiffeur du Marais', 'Boulangerie Paul', 'Urgences Dentaires', 'Pharmacie de Garde');
