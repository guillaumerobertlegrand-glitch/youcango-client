-- Fix Complete Onboarding RPC
-- Was incorrectly setting step to 4. Updated to 5.

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
    v_valid BOOLEAN;
BEGIN
    -- 1. Validate All Steps
    SELECT * FROM api_v1_validate_onboarding_step(1, p_org_id) INTO v_s1;
    SELECT * FROM api_v1_validate_onboarding_step(2, p_org_id) INTO v_s2;
    SELECT * FROM api_v1_validate_onboarding_step(3, p_org_id) INTO v_s3;
    SELECT * FROM api_v1_validate_onboarding_step(4, p_org_id) INTO v_s4;

    v_valid := (v_s1->>'valid')::boolean 
           AND (v_s2->>'valid')::boolean 
           AND (v_s3->>'valid')::boolean 
           AND (v_s4->>'valid')::boolean;

    IF v_valid THEN
        -- 2. Success: Update Org Status and Step to 5
        UPDATE public.organizations 
        SET 
            onboarding_status = 'completed',
            onboarding_step = 5
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
                '4', v_s4
            )
        );
    END IF;
END;
$$;
