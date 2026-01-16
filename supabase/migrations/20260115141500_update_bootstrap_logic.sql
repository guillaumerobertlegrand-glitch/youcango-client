-- Logic for Config Engine: Seeding & Bootstrapping

-- 1. Seeding RPC: Injects services from Specialty Template
CREATE OR REPLACE FUNCTION api_v1_seed_initial_services(
    p_org_id UUID,
    p_specialty_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template JSONB;
    v_item JSONB;
BEGIN
    -- Get Template
    SELECT catalog_template INTO v_template
    FROM public.config_specialties
    WHERE id = p_specialty_id;

    IF v_template IS NULL OR jsonb_array_length(v_template) = 0 THEN
        RETURN;
    END IF;

    -- Loop and Insert
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_template)
    LOOP
        INSERT INTO public.services (
            organization_id,
            designation,
            estimated_duration,
            price,
            active
        ) VALUES (
            p_org_id,
            v_item->>'title',
            (v_item->>'duration')::INTERVAL,
            (v_item->>'price')::NUMERIC,
            true
        );
    END LOOP;
END;
$$;


-- 2. Update Bootstrap RPC to accept p_specialty_id
CREATE OR REPLACE FUNCTION api_v1_bootstrap_organization(
    p_org_name TEXT, 
    p_first_name TEXT,
    p_last_name TEXT,
    p_siret TEXT,
    p_official_name TEXT,
    p_ape_code TEXT,
    p_specialty_id UUID DEFAULT NULL -- New Parameter
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
        'service', 
        1,
        p_specialty_id
    ) 
    RETURNING id INTO v_org_id;

    -- 2. Create Professional (Admin)
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
