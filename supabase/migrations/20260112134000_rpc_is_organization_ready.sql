-- RPC: Check Organization Readiness
-- Validates configuration before going live.

CREATE OR REPLACE FUNCTION api_v1_is_organization_ready(
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_stripe BOOLEAN;
    v_has_services BOOLEAN;
    v_has_authorized_pros BOOLEAN;
    v_has_devices BOOLEAN;
    v_is_ready BOOLEAN;
BEGIN
    -- 1. Check Stripe Secret
    SELECT EXISTS (
        SELECT 1 FROM public.organization_secrets
        WHERE organization_id = p_org_id AND stripe_account_id IS NOT NULL
    ) INTO v_has_stripe;

    -- 2. Check Services (at least one active)
    SELECT EXISTS (
        SELECT 1 FROM public.services
        WHERE organization_id = p_org_id AND active = true
    ) INTO v_has_services;

    -- 3. Check Authorized Pros (at least one Pro with minimal config)
    SELECT EXISTS (
        SELECT 1 
        FROM public.professionals p
        JOIN public.professional_service_authorizations a ON a.professional_id = p.id
        WHERE p.organization_id = p_org_id AND p.status = 'active' AND a.authorized = true
    ) INTO v_has_authorized_pros;

    -- 4. Check Devices (at least one assigned to an active Pro of this Org)
    SELECT EXISTS (
        SELECT 1 
        FROM public.devices d
        JOIN public.professionals p ON d.pro_id = p.id
        WHERE p.organization_id = p_org_id AND d.status = 'active'
    ) INTO v_has_devices;

    v_is_ready := v_has_stripe AND v_has_services AND v_has_authorized_pros AND v_has_devices;

    RETURN jsonb_build_object(
        'ready', v_is_ready,
        'checks', jsonb_build_object(
            'has_stripe', v_has_stripe,
            'has_services', v_has_services,
            'has_authorized_pros', v_has_authorized_pros,
            'has_devices', v_has_devices
        )
    );
END;
$$;
