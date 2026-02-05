-- FIX: Simplify Step 3 Validation (Permissive Mode)
-- Instead of complex business type detection, we simply check if ANY valid data for Step 3 exists.
-- Logic: Valid IF (Price Range is Set) OR (Services Count > 0).

CREATE OR REPLACE FUNCTION api_v1_validate_onboarding_step(
    p_step INTEGER,
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_valid BOOLEAN := FALSE;
    v_details JSONB;
    v_ape TEXT;
BEGIN
    CASE p_step
        WHEN 1 THEN
            -- Step 1: IDENTITY
            SELECT (siret IS NOT NULL AND official_name IS NOT NULL)
            INTO v_is_valid
            FROM public.organizations WHERE id = p_org_id;
            
            v_details := jsonb_build_object('has_identity', v_is_valid);

        WHEN 2 THEN
            -- Step 2: FINANCE
            SELECT EXISTS (
                SELECT 1 FROM public.organization_secrets 
                WHERE organization_id = p_org_id 
                AND stripe_account_id IS NOT NULL
            ) INTO v_is_valid;
            v_details := jsonb_build_object('has_stripe', v_is_valid);

        WHEN 3 THEN
            -- Step 3: CATALOG (Universal)
            DECLARE
                v_price_range INT;
                v_service_count INT;
            BEGIN
                -- Check for valid data regardless of business Type
                SELECT price_range INTO v_price_range FROM public.organizations WHERE id = p_org_id;
                
                SELECT COUNT(*) INTO v_service_count
                FROM public.services
                WHERE organization_id = p_org_id AND active = true;

                -- Validation: Price Range (Merchants/Restaurants) OR Services (Service Providers)
                v_is_valid := (v_price_range IS NOT NULL) OR (v_service_count > 0);
                
                v_details := jsonb_build_object(
                    'valid', v_is_valid,
                    'price_range', v_price_range,
                    'service_count', v_service_count
                );
            END;

        WHEN 4 THEN
            -- Step 4: TEAM & TOOLS
            DECLARE
                v_has_admin BOOLEAN;
                v_all_equipped BOOLEAN;
            BEGIN
                -- Check Admin
                SELECT EXISTS (
                    SELECT 1 FROM public.professionals 
                    WHERE organization_id = p_org_id AND role = 'admin' AND status = 'active'
                ) INTO v_has_admin;

                -- Check Devices (No active pro without device)
                SELECT NOT EXISTS (
                    SELECT 1 FROM public.professionals p
                    LEFT JOIN public.devices d ON d.pro_id = p.id
                    WHERE p.organization_id = p_org_id AND p.status = 'active'
                    AND d.id IS NULL
                ) INTO v_all_equipped;

                v_is_valid := v_has_admin AND v_all_equipped;
                v_details := jsonb_build_object(
                    'has_admin', v_has_admin,
                    'all_equipped', v_all_equipped
                );
            END;

        WHEN 5 THEN
            -- Step 5: SKILLS (Matrix)
            -- If Services exist, check skills. Otherwise (Merchants), auto-valid.
            DECLARE
                 v_service_exists BOOLEAN;
            BEGIN
                SELECT EXISTS (SELECT 1 FROM public.services WHERE organization_id = p_org_id AND active = true)
                INTO v_service_exists;
                
                IF NOT v_service_exists THEN
                     -- No services = No skills needed (Merchant/Restaurant)
                     v_is_valid := TRUE;
                     v_details := jsonb_build_object('mode', 'merchant_bypass', 'valid', true);
                ELSE
                    -- Services exist = Check Authorizations
                    SELECT EXISTS (
                        SELECT 1 FROM public.professional_service_authorizations psa
                        JOIN public.professionals p ON p.id = psa.professional_id
                        WHERE p.organization_id = p_org_id AND psa.authorized = true
                    ) INTO v_is_valid;
                    v_details := jsonb_build_object('mode', 'service', 'has_skills', v_is_valid);
                END IF;
            END;

        WHEN 6 THEN
            -- Step 6: READY
            v_is_valid := TRUE;
            v_details := jsonb_build_object('ready', true);

        ELSE
            RAISE EXCEPTION 'Invalid Step Number %', p_step;
    END CASE;

    RETURN jsonb_build_object(
        'step', p_step,
        'valid', v_is_valid,
        'details', v_details
    );
END;
$$;
