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
    v_type TEXT;
    v_cat TEXT;
    v_price INT;
BEGIN
    SELECT LOWER(TRIM(business_type)), LOWER(TRIM(category)), price_range 
    INTO v_type, v_cat, v_price
    FROM public.organizations WHERE id = p_org_id;

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
             -- Step 3: CATALOG (Using Price Range or Services)
            DECLARE
                v_service_count INT;
            BEGIN
                SELECT COUNT(*) INTO v_service_count
                FROM public.services
                WHERE organization_id = p_org_id AND active = true;

                v_is_valid := (v_price IS NOT NULL) OR (v_service_count > 0);
                v_details := jsonb_build_object('valid', v_is_valid);
            END;

        WHEN 4 THEN
            -- Step 4: TEAM & TOOLS
            DECLARE
                v_has_admin BOOLEAN;
                v_all_equipped BOOLEAN;
            BEGIN
                SELECT EXISTS (SELECT 1 FROM public.professionals WHERE organization_id = p_org_id AND role = 'admin' AND status = 'active') INTO v_has_admin;
                SELECT NOT EXISTS (
                    SELECT 1 FROM public.professionals p
                    LEFT JOIN public.devices d ON d.pro_id = p.id
                    WHERE p.organization_id = p_org_id AND p.status = 'active' AND d.id IS NULL
                ) INTO v_all_equipped;

                v_is_valid := v_has_admin AND v_all_equipped;
                v_details := jsonb_build_object('has_admin', v_has_admin, 'all_equipped', v_all_equipped);
            END;

        WHEN 5 THEN
            -- Step 5: SKILLS (Refined Logic - USER PROVIDED 2026-02-05)
            -- LOGIQUE : MERCHANT ou RESTAURANT = Prix uniquement
            IF (v_type = 'merchant') OR (v_cat = 'restaurant') THEN
                 v_is_valid := (v_price IS NOT NULL);
                 v_details := jsonb_build_object(
                     'mode', 'merchant_or_restaurant',
                     'valid', v_is_valid, 
                     'has_price', (v_price IS NOT NULL),
                     'applied_type', v_type,
                     'applied_cat', v_cat
                 );
            ELSE
                 -- LOGIQUE : SERVICE (Coiffeur, Garage...) = Prix + Skills
                 DECLARE
                    v_auth_exists BOOLEAN;
                 BEGIN
                     SELECT EXISTS (
                        SELECT 1 FROM public.professional_service_authorizations psa
                        JOIN public.professionals p ON p.id = psa.professional_id
                        WHERE p.organization_id = p_org_id AND psa.authorized = true
                    ) INTO v_auth_exists;
                    
                    v_is_valid := (v_price IS NOT NULL) AND v_auth_exists;
                    v_details := jsonb_build_object(
                        'mode', 'service',
                        'valid', v_is_valid,
                        'has_price', (v_price IS NOT NULL),
                        'has_skills', v_auth_exists
                    );
                 END;
            END IF;

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
