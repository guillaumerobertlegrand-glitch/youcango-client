-- Bootstrap New Organization
-- Used by the FIRST user to create the org and become its Admin.

CREATE OR REPLACE FUNCTION api_v1_bootstrap_organization(
    p_org_name TEXT,
    p_first_name TEXT,
    p_last_name TEXT
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

    -- 1. Create Organization
    INSERT INTO public.organizations (name, business_type, onboarding_step)
    VALUES (p_org_name, 'service', 1) -- Default to 'service' for now, can be updated later
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
