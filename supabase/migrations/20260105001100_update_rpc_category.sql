-- RPC to handle Profile Updates (Org + Location)
-- Updated to include Category and Description for better SEO/Matching.

CREATE OR REPLACE FUNCTION api_v1_update_pro_profile(
    p_org_id UUID,
    p_name TEXT,
    p_category TEXT,       -- NEW
    p_description TEXT,    -- NEW
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
    -- 1. Update Organization Details
    UPDATE public.organizations
    SET 
        name = p_name,
        category = p_category,         -- NEW
        description = p_description,   -- NEW
        updated_at = now()
    WHERE id = p_org_id;

    -- 2. Update Location (Address & GPS)
    UPDATE public.locations
    SET
        address = p_address,
        coordinates = ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography,
        updated_at = now()
    WHERE organization_id = p_org_id;
    
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
