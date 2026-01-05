-- Migration to add api_v1_start_service RPC
-- Enables transition from 'pending' to 'in_progress'

CREATE OR REPLACE FUNCTION api_v1_start_service(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_id UUID;
    v_current_state TEXT;
BEGIN
    -- Check current state
    SELECT state INTO v_current_state
    FROM public.sessions
    WHERE id = p_session_id;

    IF v_current_state IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found');
    END IF;

    IF v_current_state != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session must be in pending state to start service. Current: ' || v_current_state);
    END IF;

    -- Update state to 'in_progress'
    UPDATE public.sessions
    SET 
        state = 'in_progress',
        updated_at = now()
    WHERE 
        id = p_session_id
    RETURNING id INTO v_updated_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_updated_id, 'new_state', 'in_progress');
END;
$$;
