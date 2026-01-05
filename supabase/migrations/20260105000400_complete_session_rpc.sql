-- RPC for System/Pro to Complete a Session (P5 Trigger)
-- Moves state from 'pending' to 'completed'

CREATE OR REPLACE FUNCTION api_v1_complete_session(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_id UUID;
BEGIN
    UPDATE public.sessions
    SET 
        state = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE 
        id = p_session_id
        AND state IN ('pending', 'in_progress') -- Ensure we complete active sessions
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found or not in pending state');
    END IF;

    RETURN jsonb_build_object('success', true, 'session_id', v_updated_id, 'new_state', 'completed');
END;
$$;
