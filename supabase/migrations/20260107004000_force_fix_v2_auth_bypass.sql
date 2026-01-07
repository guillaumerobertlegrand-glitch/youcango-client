-- FORCE FIX V2: AMBIGUOUS RPC + AUTH BYPASS
-- Drop ALL potential variations of the function to clean the slate.

-- 1. Drop known signatures (explicitly)
DROP FUNCTION IF EXISTS api_v1_create_session(uuid, text, integer); 
DROP FUNCTION IF EXISTS api_v1_create_session(uuid, text, integer, uuid); 
DROP FUNCTION IF EXISTS api_v1_create_session(uuid, text, integer, text); 
DROP FUNCTION IF EXISTS api_v1_create_session(uuid, text, integer, uuid, text); 

-- 2. Re-create the SINGLE authoritative definition WITH DEMO AUTH BYPASS
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL,
    p_slot_id UUID DEFAULT NULL,
    p_service_requested TEXT DEFAULT 'Service'
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
    -- [DEMO HACK] Try to get auth.uid(), if null use a random/generated UUID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        -- Generate a temporary ID for anonymous demo user
        -- In a real app we would use an Anonymous Auth flow or passing p_guest_id
        v_user_id := gen_random_uuid();
    END IF;

    INSERT INTO public.sessions (
        customer_id,
        location_id,
        monetization_model,
        arrival_timing,
        slot_id,
        state,
        service_requested
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        p_slot_id,
        'locking',
        p_service_requested
    )
    RETURNING id INTO v_session_id;

    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'status', 'created',
        'is_anonymous', (auth.uid() IS NULL)
    ) INTO v_result;

    RETURN v_result;
END;
$$;
