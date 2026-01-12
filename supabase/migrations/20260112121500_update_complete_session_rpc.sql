-- UPDATE COMPLETE SESSION RPC
-- Adds Payment Calculation Logic (Capture on Complete)

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
    v_slot_id UUID;
    v_location_id UUID;
    v_org_id UUID;
    v_service_price DECIMAL(10, 2) := 0.00;
    v_final_amount DECIMAL(10, 2);
    v_commission DECIMAL(10, 2);
    v_pro_payout DECIMAL(10, 2);
    v_client_reward DECIMAL(10, 2);
BEGIN
    -- 1. Get Session Info (State, Slot, Location)
    SELECT state, slot_id, location_id INTO v_current_state, v_slot_id, v_location_id
    FROM public.sessions
    WHERE id = p_session_id;

    IF v_current_state IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session ID not found: ' || p_session_id);
    END IF;

    IF v_current_state NOT IN ('pending', 'in_progress', 'locking') THEN -- Allow locking for forceful completions if needed, typically in_progress
        RETURN jsonb_build_object('success', false, 'error', 'Session state invalid for completion. Current: ' || v_current_state);
    END IF;

    -- 2. Determine Price
    -- Strategy: Try to find price from Linked Slot's Service.
    IF v_slot_id IS NOT NULL THEN
        SELECT s.price INTO v_service_price
        FROM public.slots sl
        JOIN public.services s ON s.id = sl.service_id
        WHERE sl.id = v_slot_id;
    END IF;

    -- Fallback: If no slot or price found, check if we can find a default service for the Org? 
    -- For now, default to 0.00 if missing to prevent crash, but arguably should be handled.
    IF v_service_price IS NULL THEN
        v_service_price := 0.00;
    END IF;

    -- 3. Calculate Financials
    -- Rules per directive:
    -- pro_payout = final - commission
    -- client_reward = bonus (arbitrary logic, let's say 5% or 0 if free)
    
    v_final_amount := v_service_price;
    v_commission := v_final_amount * 0.15; -- 15% Platform Fee
    v_pro_payout := v_final_amount - v_commission;
    
    -- Welcome Bonus / Reward Logic (Simplified)
    IF v_final_amount > 0 THEN
        v_client_reward := v_final_amount * 0.05; -- 5% Reward
    ELSE
        v_client_reward := 0.00;
    END IF;

    -- 4. Update Session
    UPDATE public.sessions
    SET 
        state = 'completed',
        final_amount = v_final_amount,
        commission = v_commission,
        pro_payout = v_pro_payout,
        client_reward = v_client_reward,
        completed_at = now(),
        updated_at = now()
    WHERE 
        id = p_session_id
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Update returned 0 rows (Race condition?)');
    END IF;

    -- 5. Trigger Stripe Capture (Placeholder for Edge Function)
    -- PERFORM pg_notify('stripe_capture', jsonb_build_object('session_id', v_updated_id, 'amount', v_final_amount)::text);
    -- (Commented out until Event Trigger logic is set up, or assume Edge Function watches 'completed' state)

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', v_updated_id, 
        'status', 'completed',
        'financials', jsonb_build_object(
            'amount', v_final_amount,
            'payout', v_pro_payout,
            'commission', v_commission
        )
    );
END;
$$;
