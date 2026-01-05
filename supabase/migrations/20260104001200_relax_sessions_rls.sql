-- RELAX RLS FOR DEMO
-- The Pro needs to 'see' the session created by the Client to receive the Realtime Event.
-- Current policy only allows "Own Sessions". We open it up.

DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;

-- Allow any authenticated user (Pro) to view ALL sessions (for the demo)
DROP POLICY IF EXISTS "Allow authenticated view all sessions" ON public.sessions;
CREATE POLICY "Allow authenticated view all sessions" ON public.sessions
FOR SELECT TO authenticated USING (true);

-- Also allow Anonymous read if needed (though Pro is authenticated)
DROP POLICY IF EXISTS "Allow anon view all sessions" ON public.sessions;
CREATE POLICY "Allow anon view all sessions" ON public.sessions
FOR SELECT TO anon USING (true);
