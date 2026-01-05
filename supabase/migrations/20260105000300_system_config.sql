-- SYSTEM CONFIGURATION & PARAMETERS
-- Central table for managing business rules (Cooldowns, Timers, etc.)

-- 1. Create Config Table (Singleton)
CREATE TABLE IF NOT EXISTS public.system_config (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Force singleton
    cooldown_duration_minutes INTEGER DEFAULT 30,
    cancellation_window_seconds INTEGER DEFAULT 60,
    search_radius_meters INTEGER DEFAULT 5000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Insert Default Values (if not exists)
INSERT INTO public.system_config (id, cooldown_duration_minutes, cancellation_window_seconds, search_radius_meters)
VALUES (1, 30, 60, 5000)
ON CONFLICT (id) DO NOTHING;

-- RLS (Read-only for everyone, Write for Admin only)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read config" ON public.system_config;
CREATE POLICY "Allow public read config" ON public.system_config FOR SELECT USING (true);


-- 3. Update Cancel Session RPC to use Dynamic Cooldown
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
    v_cooldown_minutes INTEGER;
BEGIN
    -- Get Config
    SELECT cooldown_duration_minutes INTO v_cooldown_minutes FROM public.system_config WHERE id = 1;
    -- Fallback safety
    IF v_cooldown_minutes IS NULL THEN v_cooldown_minutes := 30; END IF;

    -- Get session details
    SELECT customer_id INTO v_customer_id 
    FROM public.sessions 
    WHERE id = p_session_id;

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

    -- Insert Cooldown with Dynamic Duration
    INSERT INTO public.cooldowns (user_id, organization_id, expires_at)
    SELECT 
        v_customer_id, 
        l.organization_id, 
        now() + (v_cooldown_minutes || ' minutes')::INTERVAL
    FROM public.locations l
    WHERE l.id = (SELECT location_id FROM public.sessions WHERE id = v_updated_id);

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', v_updated_id, 
        'new_state', 'cancelled', 
        'cooldown_minutes', v_cooldown_minutes
    );
END;
$$;
