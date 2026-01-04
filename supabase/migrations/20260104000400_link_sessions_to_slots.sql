-- Add slot_id to sessions to link a booking to a specific time/pro
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES public.slots(id);

-- Update the RPC to accept slot_id PRESERVING existing params
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL,
    p_slot_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
        state
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        p_slot_id,
        'locking'
    )
    RETURNING id INTO v_session_id;

    -- If slot is provided, ideally mark it as held/reserved here
    -- For MVP/Demo we skip strict inventory locking logic

    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'status', 'created'
    ) INTO v_result;

    RETURN v_result;
END;
$$;
