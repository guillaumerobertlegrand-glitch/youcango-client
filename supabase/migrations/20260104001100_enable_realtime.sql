-- Enable Realtime for sessions table
-- By default, Supabase does not broadcast table changes. We must explicitly enable it.

-- Add the valid table to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
