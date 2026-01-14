-- ATOMIC BOOTSTRAP FIX
-- Ensures that creating an Organization ALWAYS creates the Admin Professional.
-- Fail hard if Pro creation fails (Rolling back the Organization).

CREATE OR REPLACE FUNCTION api_v1_bootstrap_organization(
    p_org_name TEXT, 
    p_first_name TEXT,
    p_last_name TEXT,
    p_siret TEXT,
    p_official_name TEXT,
    p_ape_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Force search path for security
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_pro_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Create Organization
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
        'service', 
        1 
    ) 
    RETURNING id INTO v_org_id;

    -- 2. Create Professional (Admin)
    -- We use RETURNING to verify insertion
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
    )
    RETURNING id INTO v_pro_id;

    -- 3. Verification
    IF v_pro_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create Professional Profile. Transaction Rolled Back.';
    END IF;

    -- 4. Success Response
    RETURN jsonb_build_object(
        'success', true,
        'organization_id', v_org_id,
        'pro_id', v_pro_id
    );
END;
$$;
