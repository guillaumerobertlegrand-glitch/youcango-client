-- Refactor Onboarding to 6 Steps
-- Step 5: Skills (Matrix)
-- Step 6: Ready (Final Check)

-- 1. Update Validation RPC
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
            -- Step 3: CATALOG
            SELECT EXISTS (
                SELECT 1 FROM public.services
                WHERE organization_id = p_org_id 
                AND active = true
            ) INTO v_is_valid;
            v_details := jsonb_build_object('has_services', v_is_valid);

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
            -- Logic: At least one authorization exists? 
            -- Given "All checked by default", valid creation implies rows exist.
            -- We can be permissive or strict. strict = "at least one active pro has at least one skill".
            SELECT EXISTS (
                SELECT 1 FROM public.professional_service_authorizations psa
                JOIN public.professionals p ON p.id = psa.professional_id
                WHERE p.organization_id = p_org_id AND psa.authorized = true
            ) INTO v_is_valid;

            v_details := jsonb_build_object('has_skills', v_is_valid);

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

-- 2. Update Complete Onboarding RPC
CREATE OR REPLACE FUNCTION api_v1_complete_onboarding(
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_s1 JSONB;
    v_s2 JSONB;
    v_s3 JSONB;
    v_s4 JSONB;
    v_s5 JSONB;
    v_valid BOOLEAN;
BEGIN
    -- 1. Validate All Steps 1-5
    SELECT * FROM api_v1_validate_onboarding_step(1, p_org_id) INTO v_s1;
    SELECT * FROM api_v1_validate_onboarding_step(2, p_org_id) INTO v_s2;
    SELECT * FROM api_v1_validate_onboarding_step(3, p_org_id) INTO v_s3;
    SELECT * FROM api_v1_validate_onboarding_step(4, p_org_id) INTO v_s4;
    SELECT * FROM api_v1_validate_onboarding_step(5, p_org_id) INTO v_s5;

    v_valid := (v_s1->>'valid')::boolean 
           AND (v_s2->>'valid')::boolean 
           AND (v_s3->>'valid')::boolean 
           AND (v_s4->>'valid')::boolean
           AND (v_s5->>'valid')::boolean;

    IF v_valid THEN
        -- 2. Success: Update Org Status
        UPDATE public.organizations 
        SET 
            onboarding_status = 'completed',
            onboarding_step = 6 -- Move to "Ready" / Done state
        WHERE id = p_org_id;

        RETURN jsonb_build_object('success', true, 'message', 'Onboarding completed successfully.');
    ELSE
        -- 3. Failure: Return details
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Validation failed. Check steps.',
            'steps', jsonb_build_object(
                '1', v_s1,
                '2', v_s2,
                '3', v_s3,
                '4', v_s4,
                '5', v_s5
            )
        );
    END IF;
END;
$$;
