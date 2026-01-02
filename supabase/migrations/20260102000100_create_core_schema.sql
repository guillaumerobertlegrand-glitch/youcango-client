-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- Profiles table (linked to Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    business_type TEXT NOT NULL CHECK (business_type IN ('service', 'merchant')),
    category TEXT, -- e.g., 'bakery', 'hairdresser'
    description TEXT,
    website_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Locations table (Spatial data)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT, -- e.g., 'Shop Main Street'
    address TEXT,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
    state TEXT NOT NULL DEFAULT 'locking' CHECK (state IN ('locking', 'pending', 'completed', 'cancelled')),
    arrival_timing INTERVAL, -- Timing selection
    monetization_model TEXT CHECK (monetization_model IN ('commission', 'subscription')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_locations_coordinates ON public.locations USING GIST (coordinates);
CREATE INDEX idx_sessions_customer_id ON public.sessions (customer_id);
CREATE INDEX idx_sessions_state ON public.sessions (state);

-- RPC: api_v1_get_merchants
CREATE OR REPLACE FUNCTION api_v1_get_merchants(
    p_lat DOUBLE PRECISION,
    p_long DOUBLE PRECISION,
    p_category TEXT DEFAULT NULL,
    p_keywords TEXT[] DEFAULT '{}',
    p_radius_meters INTEGER DEFAULT 5000
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
        -- AI Intent Filter: Category
        AND (p_category IS NULL OR o.business_type = p_category)
        -- AI Intent Filter: Keywords (match in name or category)
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

-- RPC: api_v1_create_session
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_session_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.sessions (
        customer_id,
        location_id,
        monetization_model,
        arrival_timing,
        state
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        'locking'
    )
    RETURNING id INTO v_session_id;

    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'status', 'created'
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Insert some sample data for C2 demo
INSERT INTO public.organizations (name, business_type, category) VALUES 
('Le Boulanger de Paris', 'merchant', 'bakery'),
('Coupe & Style', 'service', 'hairdresser'),
('Tech Repair', 'service', 'electronics'),
('Bio Marché', 'merchant', 'grocery');

-- Coordinates around Paris (2.3522, 48.8566)
INSERT INTO public.locations (organization_id, name, address, coordinates) 
SELECT id, 'Main Location', 'Rue de Rivoli', ST_SetSRID(ST_MakePoint(2.3522 + (random()*0.02 - 0.01), 48.8566 + (random()*0.02 - 0.01)), 4326)::geography 
FROM public.organizations;
