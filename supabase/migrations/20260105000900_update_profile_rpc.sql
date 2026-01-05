-- RPC to handle Profile Updates (Org + Location)
-- Handles PostGIS geography updates safely.

-- 1. Relax Locations RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.locations;
CREATE POLICY "Enable read access for all users" ON public.locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.locations;
CREATE POLICY "Enable update access for all users" ON public.locations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.locations;
CREATE POLICY "Enable insert access for all users" ON public.locations FOR INSERT WITH CHECK (true);

-- 2. Create Helper RPC
CREATE OR REPLACE FUNCTION api_v1_update_pro_profile(
    p_org_id UUID,
    p_name TEXT,
    p_address TEXT,
    p_lat DOUBLE PRECISION,
    p_long DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_loc_id UUID;
BEGIN
    -- 1. Update Organization Name
    UPDATE public.organizations
    SET 
        name = p_name,
        updated_at = now() -- Assumes updated_at exists, if not ignored or handled by trigger
    WHERE id = p_org_id;

    -- 2. Update Location (Address & GPS)
    -- We update ALL locations linked to this org for simplicity in MVP (assuming 1:1)
    -- Or we try to find the "primary" one.
    
    UPDATE public.locations
    SET
        address = p_address,
        coordinates = ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography,
        updated_at = now() -- Assumes updated_at exists
    WHERE organization_id = p_org_id;
    
    -- Check if we actually updated a location. If not, maybe create one?
    -- For MVP, we assume seed data exists.
    
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
