-- Force Fix: Drop ALL variations of the function to ensure clean state
DROP FUNCTION IF EXISTS api_v1_create_session(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS api_v1_create_session(UUID, TEXT, INTEGER, UUID, TEXT);
DROP FUNCTION IF EXISTS api_v1_create_session(UUID, TEXT, INTEGER, UUID, TEXT, INTEGER);

-- Recreate with the latest signature
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL,
    p_slot_id UUID DEFAULT NULL,
    p_service_requested TEXT DEFAULT 'Service',
    p_estimated_arrival_duration INTEGER DEFAULT NULL
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
    -- Auth Bypass for Demo (Anonymous Users)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid(); 
    END IF;

    -- Ensure the sessions table has the column
    BEGIN
        ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS estimated_arrival_duration INTEGER;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column estimated_arrival_duration already exists in sessions.';
    END;

    INSERT INTO public.sessions (
        customer_id,
        location_id,
        monetization_model,
        arrival_timing,
        state,
        slot_id,
        service_requested,
        estimated_arrival_duration
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        'locking',
        p_slot_id,
        p_service_requested,
        p_estimated_arrival_duration
    )
    RETURNING id INTO v_session_id;

    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'status', 'created'
    ) INTO v_result;

    RETURN v_result;
END;
$$;
