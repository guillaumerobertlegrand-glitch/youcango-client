ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS intent_mode TEXT DEFAULT 'immediacy' CHECK (intent_mode IN ('immediacy', 'delayed'));

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_state_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_state_check 
CHECK (state IN ('scheduled', 'locking', 'pending', 'in_progress', 'completed', 'cancelled'));
