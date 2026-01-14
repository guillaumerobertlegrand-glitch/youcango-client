-- FIX: Add missing columns required by Application Logic
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- REPAIR: Populate them for existing users (split full_name or default)
UPDATE public.profiles
SET 
  first_name = COALESCE(SPLIT_PART(full_name, ' ', 1), 'Test'),
  last_name = COALESCE(SPLIT_PART(full_name, ' ', 2), 'User')
WHERE first_name IS NULL;

-- INSERT missing rows for Auth Users (Safe fallback)
INSERT INTO public.profiles (id, full_name, first_name, last_name)
SELECT 
    id, 
    'Test User', 
    'Test', 
    'User'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
