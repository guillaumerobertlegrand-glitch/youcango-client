-- FORCE FIX: AMBIGUOUS RPC
-- Drop ALL potential variations of the function to clean the slate.

-- 1. Drop known signatures (explicitly)
DROP FUNCTION IF EXISTS api_v1_create_session(uuid, text, integer); -- Original
DROP FUNCTION IF EXISTS api_v1_create_session(uuid, text, integer, uuid); -- With Slot
DROP FUNCTION IF EXISTS api_v1_create_session(uuid, text, integer, text); -- (Incorrect guess)
DROP FUNCTION IF EXISTS api_v1_create_session(uuid, text, integer, uuid, text); -- Latest attempt

-- 2. Re-create the SINGLE authoritative definition
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL,
    p_slot_id UUID DEFAULT NULL,
    p_service_requested TEXT DEFAULT 'Service'
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
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.sessions (
        customer_id,
        location_id,
        monetization_model,
        arrival_timing,
        slot_id,
        state,
        service_requested
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        p_slot_id,
        'locking',
        p_service_requested
    )
    RETURNING id INTO v_session_id;

    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'status', 'created'
    ) INTO v_result;

    RETURN v_result;
END;
$$;
