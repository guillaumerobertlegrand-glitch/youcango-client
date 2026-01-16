-- Reduce Cooldown Duration from 30m to 30s
-- Reason: Facilitate testing and demo loops.

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
    v_customer_id UUID;
    v_org_id UUID;
BEGIN
    -- Get session details
    SELECT customer_id, location_id INTO v_customer_id, v_org_id 
    FROM public.sessions 
    JOIN public.locations l ON l.id = sessions.location_id
    WHERE sessions.id = p_session_id;

    -- Update state
    UPDATE public.sessions
    SET 
        state = 'cancelled',
        updated_at = now()
    WHERE 
        id = p_session_id
        AND state = 'locking'
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found or not in locking state');
    END IF;

    -- Insert Cooldown (30 SECONDS)
    INSERT INTO public.cooldowns (user_id, organization_id, expires_at)
    SELECT 
        v_customer_id, 
        l.organization_id, 
        now() + interval '30 seconds' -- REDUCED from 30 minutes
    FROM public.locations l
    WHERE l.id = (SELECT location_id FROM public.sessions WHERE id = v_updated_id);

    RETURN jsonb_build_object('success', true, 'session_id', v_updated_id, 'new_state', 'cancelled', 'cooldown', true);
END;
$$;
