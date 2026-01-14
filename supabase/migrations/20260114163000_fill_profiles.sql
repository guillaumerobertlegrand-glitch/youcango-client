-- Auto-fill empty profiles to bypass Client Onboarding in Dev/Local
UPDATE public.profiles 
SET 
  first_name = 'Test', 
  last_name = 'User', 
  full_name = 'Test User'
WHERE first_name IS NULL OR last_name IS NULL;
