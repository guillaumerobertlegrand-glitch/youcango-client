-- PHASE 1.2: PAYMENT FLOW SCHEMA & LOGIC

-- 1. Update Sessions Table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none', -- none, proposed, paid, rejected_retry, failed
ADD COLUMN IF NOT EXISTS payment_attempts INTEGER DEFAULT 0;

-- 2. Update Config Table
ALTER TABLE public.system_config
ADD COLUMN IF NOT EXISTS payment_timer_seconds INTEGER DEFAULT 5;


-- 3. RPC: Propose Payment (Pro -> Client)
CREATE OR REPLACE FUNCTION api_v1_propose_payment(
    p_session_id UUID,
    p_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_id UUID;
    v_attempts INTEGER;
BEGIN
    SELECT payment_attempts INTO v_attempts FROM public.sessions WHERE id = p_session_id;

    IF v_attempts >= 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment attempts exceeded');
    END IF;

    UPDATE public.sessions
    SET 
        amount = p_amount,
        payment_status = 'proposed',
        updated_at = now()
    WHERE 
        id = p_session_id
    RETURNING id INTO v_updated_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_updated_id, 'status', 'proposed');
END;
$$;


-- 4. RPC: Reject Payment (Client -> Pro)
CREATE OR REPLACE FUNCTION api_v1_reject_payment(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempts INTEGER;
    v_new_status TEXT;
BEGIN
    -- Increment attempts
    UPDATE public.sessions
    SET payment_attempts = payment_attempts + 1
    WHERE id = p_session_id
    RETURNING payment_attempts INTO v_attempts;

    -- Determine next state
    IF v_attempts < 3 THEN
        v_new_status := 'rejected_retry';
    ELSE
        v_new_status := 'failed';
    END IF;

    -- Update Status
    UPDATE public.sessions
    SET payment_status = v_new_status, updated_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true, 'new_status', v_new_status, 'attempts', v_attempts);
END;
$$;


-- 5. RPC: Finalize Payment (Client Timer / Auto)
CREATE OR REPLACE FUNCTION api_v1_finalize_payment(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.sessions
    SET 
        payment_status = 'paid',
        state = 'completed', -- Ensure final state
        updated_at = now()
    WHERE 
        id = p_session_id;

    -- Here we would trigger Stripe Capture in a real implementation

    RETURN jsonb_build_object('success', true, 'status', 'paid');
END;
$$;
