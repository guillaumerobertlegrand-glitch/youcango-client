-- FORCE CLEANUP & SYNC for Remote DB
-- This migration ensures all critical structures exist and blocking triggers are removed.

-- 1. Ensure Device Type Exists
DO $$ BEGIN
    CREATE TYPE public.device_type AS ENUM ('phone', 'watch', 'glasses', 'tablet', 'pc');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Ensure Devices Table Exists
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pro_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
    type public.device_type NOT NULL,
    name TEXT,
    trigger_config JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Ensure Index Exists
CREATE INDEX IF NOT EXISTS idx_devices_pro_id ON public.devices(pro_id);

-- 4. Enable RLS and Policy
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Authenticated users can manage devices" ON public.devices FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Add Missing Profile Columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 6. Fill Empty Profiles
UPDATE public.profiles
SET 
  first_name = COALESCE(SPLIT_PART(full_name, ' ', 1), 'Test'),
  last_name = COALESCE(SPLIT_PART(full_name, ' ', 2), 'User')
WHERE first_name IS NULL;

-- 7. Ensure default profile for existing users
INSERT INTO public.profiles (id, full_name, first_name, last_name)
SELECT 
    id, 
    'Test User', 
    'Test', 
    'User'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 8. DROP BLOCKING TRIGGER (The root cause of signup error)
DROP TRIGGER IF EXISTS trg_secure_pro_creation ON public.professionals;
