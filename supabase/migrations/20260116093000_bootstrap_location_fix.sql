-- Update Bootstrap RPC to create Location record
-- Fixes issue where new Orgs are invisible on Map.

CREATE OR REPLACE FUNCTION api_v1_bootstrap_organization(
    p_org_name TEXT, 
    p_first_name TEXT,
    p_last_name TEXT,
    p_siret TEXT,
    p_official_name TEXT,
    p_ape_code TEXT,
    p_specialty_id UUID DEFAULT NULL,
    p_address TEXT DEFAULT 'Adresse inconnue',
    p_lat DOUBLE PRECISION DEFAULT 48.8566, -- Paris (Default)
    p_long DOUBLE PRECISION DEFAULT 2.3522    -- Paris (Default)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Create Organization with Identity
    INSERT INTO public.organizations (
        name, 
        official_name, 
        siret, 
        ape_code, 
        business_type, 
        onboarding_step,
        specialty_id -- Store Specialty
    )
    VALUES (
        p_org_name, 
        p_official_name, 
        p_siret, 
        p_ape_code, 
        'service', -- Default to service, can be enhanced logic later
        1,
        p_specialty_id
    ) 
    RETURNING id INTO v_org_id;

    -- 1.5 Create Location (CRITICAL for Map Visibility)
    -- We use ST_SetSRID(ST_MakePoint(long, lat), 4326)
    INSERT INTO public.locations (
        organization_id,
        name,
        address,
        coordinates
    ) VALUES (
        v_org_id,
        'Siège Social',
        p_address,
        ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography
    );

    -- 2. Create Professional (Admin) of status ACTIVE
    INSERT INTO public.professionals (
        organization_id,
        user_id,
        first_name,
        last_name,
        role,
        status
    ) VALUES (
        v_org_id,
        v_user_id,
        p_first_name,
        p_last_name,
        'admin',
        'active' -- User requested "Available by default"
    );

    -- 3. Seed Services if Specialty Provided
    IF p_specialty_id IS NOT NULL THEN
        PERFORM api_v1_seed_initial_services(v_org_id, p_specialty_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', v_org_id
    );
END;
$$;
