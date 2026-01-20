-- FIX: RPC Signature Ambiguity -> Move to Single JSON Param Pattern help PostgREST
-- V3: Accepts a single JSONB object containing all parameters.

CREATE OR REPLACE FUNCTION api_v1_bootstrap_organization_v3(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Extract params from payload
    p_org_name TEXT := payload->>'p_org_name';
    p_first_name TEXT := payload->>'p_first_name';
    p_last_name TEXT := payload->>'p_last_name';
    p_job_title TEXT := payload->>'p_job_title';
    p_siret TEXT := payload->>'p_siret';
    p_official_name TEXT := payload->>'p_official_name';
    p_ape_code TEXT := payload->>'p_ape_code';
    p_specialty_id UUID := (payload->>'p_specialty_id')::uuid;
    p_address TEXT := COALESCE(payload->>'p_address', 'Adresse inconnue');
    p_lat DOUBLE PRECISION := COALESCE((payload->>'p_lat')::float, 48.8566);
    p_long DOUBLE PRECISION := COALESCE((payload->>'p_long')::float, 2.3522);
    p_google_place_id TEXT := payload->>'p_google_place_id'; 
    p_opening_hours JSONB := COALESCE(payload->'p_opening_hours', '{}'::jsonb);
    p_photos JSONB := COALESCE(payload->'p_photos', '[]'::jsonb);
    p_website TEXT := payload->>'p_website';

    v_org_id UUID;
    v_user_id UUID;
    v_business_type TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lookup Business Type from Config
    SELECT business_type INTO v_business_type
    FROM public.config_industries
    WHERE p_ape_code LIKE ape_prefix || '%'
    ORDER BY length(ape_prefix) DESC
    LIMIT 1;

    IF v_business_type IS NULL THEN
        v_business_type := 'service';
    END IF;

    -- 1. Create Organization
    INSERT INTO public.organizations (
        name, 
        official_name, 
        siret, 
        ape_code, 
        business_type, 
        onboarding_step,
        specialty_id,
        latitude,
        longitude,
        google_place_id,
        opening_hours,
        photos,
        website_url
    )
    VALUES (
        p_org_name, 
        p_official_name, 
        p_siret, 
        p_ape_code, 
        v_business_type,
        1,
        p_specialty_id,
        p_lat,
        p_long,
        p_google_place_id,
        p_opening_hours,
        p_photos,
        p_website
    ) 
    RETURNING id INTO v_org_id;

    -- 1.5 Create Location
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

    -- 2. Create Professional (Admin)
    INSERT INTO public.professionals (
        organization_id,
        user_id,
        first_name,
        last_name,
        job_title,
        role,
        status
    ) VALUES (
        v_org_id,
        v_user_id,
        p_first_name,
        p_last_name,
        p_job_title,
        'admin',
        'active'
    );

    -- 3. Seed Services
    IF p_specialty_id IS NOT NULL THEN
        PERFORM api_v1_seed_initial_services(v_org_id, p_specialty_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', v_org_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION api_v1_bootstrap_organization_v3(JSONB) TO anon, authenticated, service_role;
