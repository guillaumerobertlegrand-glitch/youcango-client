-- Add role column to profiles if it is missing
-- This ensures consistency with invitations table and supports 'Admin' badge display.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

-- Allow RLS to update this column (already covered by UPDATE policy usually, but good to know)
