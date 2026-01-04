-- Add availability_status to professionals table
-- distinct from 'status' (active/inactive) which is administrative.
-- 'available': Ready to receive requests
-- 'busy': Currently in a job (from P2 acceptance) or geographically away (system set)

ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available' 
CHECK (availability_status IN ('available', 'busy'));

-- Index for fast lookup of available pros
CREATE INDEX IF NOT EXISTS idx_pros_availability ON public.professionals(availability_status);
