-- 1. Add column to store real-time calculated duration (from Mapbox)
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS estimated_arrival_duration INTEGER; -- Duration in minutes

-- 2. Update RPC to accept this duration
-- Drop to avoid ambiguity
DROP FUNCTION IF EXISTS api_v1_create_session;

CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL,
    p_slot_id UUID DEFAULT NULL,
    p_service_requested TEXT DEFAULT 'Service',
    p_estimated_arrival_duration INTEGER DEFAULT NULL
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
        v_user_id := gen_random_uuid(); -- Generate a fake ID for the session
    END IF;

    INSERT INTO public.sessions (
        customer_id,
        location_id,
        monetization_model,
        arrival_timing,
        state,
        slot_id,
        service_requested,
        estimated_arrival_duration -- New Field
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        'locking',
        p_slot_id,
        p_service_requested,
        p_estimated_arrival_duration
    )
    RETURNING id INTO v_session_id;

    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'status', 'created'
    ) INTO v_result;

    RETURN v_result;
END;
$$;
