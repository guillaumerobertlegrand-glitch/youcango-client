-- RESET DEMO DATA
-- Cleans up all sessions and resets professional availability
-- Use this to restore the demo to a fresh state.

-- 1. Truncate Sessions (Cascade to messages/metadata)
TRUNCATE TABLE public.sessions CASCADE;

-- 2. Truncate Cooldowns (Remove 'Decline' blocks)
TRUNCATE TABLE public.cooldowns;

-- 3. Reset Professionals Availability
UPDATE public.professionals
SET availability_status = 'available';
