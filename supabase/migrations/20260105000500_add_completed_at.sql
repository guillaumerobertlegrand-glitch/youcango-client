-- Add completed_at column to sessions table
-- Fixes error: column "completed_at" of relation "sessions" does not exist

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
