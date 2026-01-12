-- FIX REALTIME TRIGGER
-- Force Replica Identity Full on sessions to ensure all columns are sent in payload.
-- Re-add to publication to refresh.

ALTER TABLE public.sessions REPLICA IDENTITY FULL;

-- Ensure it's in the publication (Idempotent usually, but good to run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
    END IF;
END $$;
