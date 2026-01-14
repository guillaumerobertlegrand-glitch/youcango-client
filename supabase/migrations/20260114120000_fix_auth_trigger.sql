-- Fix Auth Trigger & Link Professionals
-- This migration ensures that when a new user is created (via Invite or Signup):
-- 1. A profile is created (safely).
-- 2. Any pending professional invite (matching email) is linked to this user.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- 1. Create Profile (Safely)
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name', 'New User'),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Link Pending Professional Invite
    -- If an admin invited this email, a row exists in professionals with user_id = NULL
    UPDATE public.professionals 
    SET 
        user_id = NEW.id,
        status = 'active', -- Activate them immediately upon registration/invite acceptance
        updated_at = now()
    WHERE 
        email = NEW.email 
        AND user_id IS NULL;

    RETURN NEW;
END;
$$;

-- Safely recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
