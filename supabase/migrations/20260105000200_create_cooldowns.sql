-- COOLDOWN SYSTEM FOR CANCELLATIONS
-- When a Pro declines, they are hidden from the User for 30 minutes.

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 1. Create Cooldowns Table
CREATE TABLE IF NOT EXISTS public.cooldowns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- Anonymous or Authenticated ID
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- RLS (Open for Demo)
ALTER TABLE public.cooldowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to cooldowns" ON public.cooldowns;
CREATE POLICY "Allow public access to cooldowns" ON public.cooldowns FOR ALL USING (true);


-- 2. Update Cancel Session RPC to Insert Cooldown
CREATE OR REPLACE FUNCTION api_v1_cancel_session(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_id UUID;
    v_customer_id UUID;
    v_org_id UUID;
BEGIN
    -- Get session details
    SELECT customer_id, location_id INTO v_customer_id, v_org_id 
    FROM public.sessions 
    JOIN public.locations l ON l.id = sessions.location_id
    WHERE sessions.id = p_session_id;

    -- Update state
    UPDATE public.sessions
    SET 
        state = 'cancelled',
        updated_at = now()
    WHERE 
        id = p_session_id
        AND state = 'locking'
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found or not in locking state');
    END IF;

    -- Insert Cooldown (30 minutes)
    -- Note: v_org_id here is actually location_id from the join above, 
    -- we need organization_id. Let's fix the join.
    
    INSERT INTO public.cooldowns (user_id, organization_id, expires_at)
    SELECT 
        v_customer_id, 
        l.organization_id, 
        now() + interval '30 minutes'
    FROM public.locations l
    WHERE l.id = (SELECT location_id FROM public.sessions WHERE id = v_updated_id);

    RETURN jsonb_build_object('success', true, 'session_id', v_updated_id, 'new_state', 'cancelled', 'cooldown', true);
END;
$$;


-- 3. Update Get Merchants to Filter by Cooldown
-- We DROP first because the signature changes (added p_viewer_id)

DROP FUNCTION IF EXISTS api_v1_get_merchants(double precision, double precision, text, text[], integer);

CREATE OR REPLACE FUNCTION api_v1_get_merchants(
    p_lat DOUBLE PRECISION,
    p_long DOUBLE PRECISION,
    p_category TEXT DEFAULT NULL,
    p_keywords TEXT[] DEFAULT '{}',
    p_radius_meters INTEGER DEFAULT 5000,
    p_viewer_id UUID DEFAULT NULL -- New optional param
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    business_type TEXT,
    category TEXT,
    address TEXT,
    lat DOUBLE PRECISION,
    long DOUBLE PRECISION,
    dist_meters DOUBLE PRECISION,
    location_id UUID
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
        ST_Distance(l.coordinates, ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography) AS dist_meters,
        l.id AS location_id
    FROM 
        public.organizations o
    JOIN 
        public.locations l ON l.organization_id = o.id
    WHERE 
        -- Proximity filter
        ST_Distance(l.coordinates, ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography) <= p_radius_meters
        
        -- AI Intent Filter
        AND (
            p_keywords = '{}' 
            OR EXISTS (
                SELECT 1 FROM unnest(p_keywords) kw 
                WHERE o.name ILIKE '%' || kw || '%' OR o.category ILIKE '%' || kw || '%'
            )
        )
        
        -- COOLDOWN FILTER
        -- Exclude if there is an active cooldown for this viewer and org
        AND NOT EXISTS (
            SELECT 1 FROM public.cooldowns c
            WHERE c.organization_id = o.id
            AND c.user_id = p_viewer_id
            AND c.expires_at > now()
        )

    ORDER BY 
        dist_meters ASC;
END;
$$;
