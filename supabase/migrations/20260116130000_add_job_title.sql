-- 1. Add job_title to professionals
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- 2. Update Bootstrap RPC to include job_title
CREATE OR REPLACE FUNCTION api_v1_bootstrap_organization(
    p_org_name TEXT, 
    p_first_name TEXT,
    p_last_name TEXT,
    p_job_title TEXT, -- NEW
    p_siret TEXT,
    p_official_name TEXT,
    p_ape_code TEXT,
    p_specialty_id UUID DEFAULT NULL,
    p_address TEXT DEFAULT 'Adresse inconnue',
    p_lat DOUBLE PRECISION DEFAULT 48.8566,
    p_long DOUBLE PRECISION DEFAULT 2.3522
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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

    -- Fallback
    IF v_business_type IS NULL THEN
        v_business_type := 'service';
    END IF;

    -- 1. Create Organization with Identity
    INSERT INTO public.organizations (
        name, 
        official_name, 
        siret, 
        ape_code, 
        business_type, 
        onboarding_step,
        specialty_id
    )
    VALUES (
        p_org_name, 
        p_official_name, 
        p_siret, 
        p_ape_code, 
        v_business_type,
        1,
        p_specialty_id
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

    -- 2. Create Professional (Admin) of status ACTIVE with Identity & Function
    INSERT INTO public.professionals (
        organization_id,
        user_id,
        first_name,
        last_name,
        job_title, -- NEW
        role,
        status
    ) VALUES (
        v_org_id,
        v_user_id,
        p_first_name,
        p_last_name,
        p_job_title, -- NEW
        'admin',
        'active'
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
