-- Drop potentially conflicting signatures
DROP FUNCTION IF EXISTS api_v1_create_session(UUID, TEXT, INTEGER, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS api_v1_create_session(UUID, UUID, UUID, UUID, TEXT, INTEGER);

-- Recreate with the correct signature matching MapWrapper.tsx
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL,
    p_slot_id UUID DEFAULT NULL,
    p_service_requested TEXT DEFAULT 'Service',
    p_estimated_arrival_duration INTEGER DEFAULT NULL,
    p_scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_intent_mode TEXT DEFAULT 'immediacy'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_session_id UUID;
    v_result JSONB;
BEGIN
    -- Auth Bypass for Demo (Anonymous Users)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid(); 
    END IF;

    -- Insert into sessions with all new columns
    INSERT INTO public.sessions (
        customer_id,
        location_id,
        monetization_model,
        arrival_timing,
        state,
        slot_id,
        service_requested,
        estimated_arrival_duration,
        scheduled_at,
        intent_mode
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        CASE WHEN p_intent_mode = 'delayed' THEN 'scheduled' ELSE 'locking' END, -- Set initial state based on mode
        p_slot_id,
        p_service_requested,
        p_estimated_arrival_duration,
        p_scheduled_at,
        p_intent_mode
    )
    RETURNING id INTO v_session_id;

    -- Return success response
    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'success', true,
        'status', 'created'
    ) INTO v_result;

    RETURN v_result;
END;
$$;
