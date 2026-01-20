-- Update Complete Session RPC to accept manual Final Amount
-- This supports variable pricing (e.g. Restaurants, Hairdressers with ranges) entered by the Pro.

CREATE OR REPLACE FUNCTION api_v1_complete_session(
    p_session_id UUID,
    p_final_amount DECIMAL(10, 2) DEFAULT NULL
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
    v_calculated_amount DECIMAL(10, 2) := 0.00;
    v_commission DECIMAL(10, 2);
    v_pro_payout DECIMAL(10, 2);
    v_client_reward DECIMAL(10, 2);
    v_commission_rate DECIMAL(10, 2) := 0.15; -- Default 15%
BEGIN
    -- 1. Get Session Info
    SELECT state, slot_id, location_id INTO v_current_state, v_slot_id, v_location_id
    FROM public.sessions
    WHERE id = p_session_id;

    IF v_current_state IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session ID not found: ' || p_session_id);
    END IF;

    IF v_current_state NOT IN ('pending', 'in_progress', 'locking', 'scheduled') THEN 
        RETURN jsonb_build_object('success', false, 'error', 'Session state invalid for completion. Current: ' || v_current_state);
    END IF;

    -- 2. Determine Amount
    IF p_final_amount IS NOT NULL THEN
        -- Manual Override (Pro entered amount)
        v_calculated_amount := p_final_amount;
    ELSE
        -- Auto-calculate from Service (Legacy/Fixed Price)
        IF v_slot_id IS NOT NULL THEN
            SELECT s.price INTO v_calculated_amount
            FROM public.slots sl
            JOIN public.services s ON s.id = sl.service_id
            WHERE sl.id = v_slot_id;
        END IF;

        IF v_calculated_amount IS NULL THEN
            v_calculated_amount := 0.00;
        END IF;
    END IF;

    -- 3. Calculate Financials
    -- Fetch Organization Commission Rate if possible (future proofing), for now fixed 15%
    -- v_commission := v_calculated_amount * v_commission_rate;
    
    -- UPDATE: Fetch commission rate from Organization Config (if relevant) or fixed.
    -- Let's stick to 15% for now as per previous logic.
    v_commission := v_calculated_amount * 0.15;
    v_pro_payout := v_calculated_amount - v_commission;
    
    -- Reward Logic (5% if paid)
    IF v_calculated_amount > 0 THEN
        v_client_reward := v_calculated_amount * 0.05;
    ELSE
        v_client_reward := 0.00;
    END IF;

    -- 4. Update Session
    UPDATE public.sessions
    SET 
        state = 'completed',
        final_amount = v_calculated_amount,
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

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', v_updated_id, 
        'status', 'completed',
        'financials', jsonb_build_object(
            'amount', v_calculated_amount,
            'payout', v_pro_payout,
            'commission', v_commission
        )
    );
END;
$$;
