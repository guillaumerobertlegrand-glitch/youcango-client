-- Enhanced Bootstrap Organization RPC
-- Accepts Legal Identity (SIRET, Name, APE) during creation.
-- Used by Step 1 to create the Org after API validation.

CREATE OR REPLACE FUNCTION api_v1_bootstrap_organization(
    p_org_name TEXT, -- Can be the Brand Name or Official Name
    p_first_name TEXT,
    p_last_name TEXT,
    p_siret TEXT,
    p_official_name TEXT,
    p_ape_code TEXT
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
        onboarding_step
    )
    VALUES (
        p_org_name, 
        p_official_name, 
        p_siret, 
        p_ape_code, 
        'service', -- Default, refined in Step 3/4 if needed
        1 -- Starts at Step 1 (technically stays at 1 until next click)
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

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', v_org_id
    );
END;
$$;
