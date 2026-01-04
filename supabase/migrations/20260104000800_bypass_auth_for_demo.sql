-- BYPASS AUTH FOR DEMO (Anonymous Users)

-- 1. Relax Session Table Constraints
-- Drop FK to profiles/auth.users if it exists (for demo flexibility)
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_customer_id_fkey;

-- Make customer_id NOT NULL -> but we will insert a generated UUID, so constraint check is fine, 
-- but ensuring it doesn't check against user table is key.
-- (The above DROP CONSTRAINT does that).

-- 2. Update RPC to allow Anonymous Session Creation
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL,
    p_slot_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
        v_user_id := gen_random_uuid();
    END IF;

    -- Create Session
    INSERT INTO public.sessions (
        customer_id,
        location_id,
        monetization_model,
        arrival_timing,
        slot_id,
        state
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        p_slot_id,
        'locking'
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
