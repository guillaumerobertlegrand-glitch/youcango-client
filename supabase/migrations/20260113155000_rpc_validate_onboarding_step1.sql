-- RPC: Validate Onboarding Step 1
-- Checks: Identity (SIRET/Names), Finance (Stripe), Team (1 Admin).

CREATE OR REPLACE FUNCTION api_v1_validate_onboarding_step1(
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_identity BOOLEAN;
    v_has_stripe BOOLEAN;
    v_has_admin BOOLEAN;
    v_is_valid BOOLEAN;
BEGIN
    -- 1. Check Identity (SIRET, Official Name, APE)
    SELECT EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = p_org_id 
        AND siret IS NOT NULL AND trim(siret) <> ''
        AND official_name IS NOT NULL AND trim(official_name) <> ''
        AND ape_code IS NOT NULL AND trim(ape_code) <> ''
    ) INTO v_has_identity;

    -- 2. Check Stripe Secret (in secure table)
    SELECT EXISTS (
        SELECT 1 FROM public.organization_secrets
        WHERE organization_id = p_org_id AND stripe_account_id IS NOT NULL
    ) INTO v_has_stripe;

    -- 3. Check Team (At least 1 active Admin - Solopreneur)
    SELECT EXISTS (
        SELECT 1 FROM public.professionals
        WHERE organization_id = p_org_id 
        AND role = 'admin' 
        AND status = 'active'
    ) INTO v_has_admin;

    v_is_valid := v_has_identity AND v_has_stripe AND v_has_admin;

    RETURN jsonb_build_object(
        'valid', v_is_valid,
        'checks', jsonb_build_object(
            'has_identity', v_has_identity,
            'has_stripe', v_has_stripe,
            'has_admin', v_has_admin
        )
    );
END;
$$;
