-- FORCE REPLACE FUNCTION api_v1_complete_session
-- This ensures the logic accepts 'in_progress' and has clear error messages.
-- Run this in the SQL Editor of Supabase.

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
    v_current_state TEXT;
BEGIN
    -- 1. Debug: Check existence and state directly
    SELECT state INTO v_current_state
    FROM public.sessions
    WHERE id = p_session_id;

    IF v_current_state IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session ID not found: ' || p_session_id);
    END IF;

    IF v_current_state NOT IN ('pending', 'in_progress') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session state invalid for completion. Current: ' || v_current_state);
    END IF;

    -- 2. Update
    UPDATE public.sessions
    SET 
        state = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE 
        id = p_session_id
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        -- Should not happen given checks above, but possible race condition
        RETURN jsonb_build_object('success', false, 'error', 'Update returned 0 rows (Race condition?)');
    END IF;

    -- 3. Success
    RETURN jsonb_build_object('success', true, 'session_id', v_updated_id, 'status', 'completed');
END;
$$;
