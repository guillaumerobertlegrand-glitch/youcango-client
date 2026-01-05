-- RPC for Pro to Cancel/Decline a Session
-- Moves state from 'locking' to 'cancelled'

CREATE OR REPLACE FUNCTION api_v1_cancel_session(
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
        state = 'cancelled',
        updated_at = now()
    WHERE 
        id = p_session_id
        AND state = 'locking' -- Ensure we only cancel active requests
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found or not in locking state');
    END IF;

    RETURN jsonb_build_object('success', true, 'session_id', v_updated_id, 'new_state', 'cancelled');
END;
$$;
