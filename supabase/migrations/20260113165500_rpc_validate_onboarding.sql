-- RPC: Master Validation Onboarding Steps
-- Validates logic for Steps 1, 2, 3, 4 based on requested step.

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
            -- Re-use Step 1 Validator
            SELECT * FROM api_v1_validate_onboarding_step1(p_org_id) INTO v_details;
            v_is_valid := (v_details->>'valid')::boolean;
            
        WHEN 2 THEN
            -- Step 2: SERVICES
            -- Requirement: At least 1 active Service with valid fields
            SELECT EXISTS (
                SELECT 1 FROM public.services
                WHERE organization_id = p_org_id 
                AND active = true
                AND designation IS NOT NULL AND trim(designation) <> ''
                -- Price constraint checking? Assuming schema constraints handle types, 
                -- but logic requires existence.
            ) INTO v_is_valid;
            v_details := jsonb_build_object('has_active_service', v_is_valid);

        WHEN 3 THEN
            -- Step 3: DEVICES
            -- Requirement: ALL active Pros must have at least 1 assigned Device.
            -- (Or at least ensuring the team is equipped).
            -- Strict Logic: 
            -- Check if there are ANY pros without a device.
            SELECT NOT EXISTS (
                SELECT 1 
                FROM public.professionals p
                LEFT JOIN public.devices d ON d.pro_id = p.id AND d.status = 'active'
                WHERE p.organization_id = p_org_id 
                AND p.status = 'active'
                AND d.id IS NULL -- Found a Pro with NO device
            ) INTO v_is_valid;
            
            -- Edge case: If 0 pros, technically valid? No, Step 1 enforces 1 Admin.
            IF v_is_valid THEN
                 -- Double check we actually have pros
                 IF NOT EXISTS (SELECT 1 FROM public.professionals WHERE organization_id = p_org_id AND status = 'active') THEN
                     v_is_valid := FALSE; 
                 END IF;
            END IF;

            v_details := jsonb_build_object('all_pros_equipped', v_is_valid);

        WHEN 4 THEN
            -- Step 4: AUTHORIZATIONS
            -- Requirement: At least 1 record in authorizations map.
            SELECT EXISTS (
                SELECT 1 
                FROM public.professional_service_authorizations psa
                JOIN public.professionals p ON psa.professional_id = p.id
                WHERE p.organization_id = p_org_id
                AND psa.authorized = true
            ) INTO v_is_valid;
            v_details := jsonb_build_object('has_skills_matrix', v_is_valid);

        ELSE
            RAISE EXCEPTION 'Invalid Step Number';
    END CASE;

    -- Update State if Valid (Auto-Advance logic or just validation? Request was "Validation")
    -- We will just return validity. The Frontend/State Machine calls update separately.
    
    RETURN jsonb_build_object(
        'step', p_step,
        'valid', v_is_valid,
        'details', v_details
    );
END;
$$;
