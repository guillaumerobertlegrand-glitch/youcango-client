-- REPAIR: Insert missing profiles for existing users
-- If the trigger failed, this SQL manually retro-fits the profile row.

INSERT INTO public.profiles (id, full_name, first_name, last_name)
SELECT 
    id, 
    'Test User', 
    'Test', 
    'User'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
