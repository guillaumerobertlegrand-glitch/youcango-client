-- ROBUST IDENTITY TRIGGER
-- Replaces the fragile handle_new_user with a version that correctly parses names
-- and populates the new schema requirements (first_name, last_name).

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_first_name TEXT;
    v_last_name TEXT;
    v_full_name TEXT;
BEGIN
    -- 1. Extract Details from Metadata (with fallbacks)
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'New');
    v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'User');
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', v_first_name || ' ' || v_last_name);

    -- 2. Create Profile (Safely)
    INSERT INTO public.profiles (id, full_name, first_name, last_name, avatar_url)
    VALUES (
        NEW.id,
        v_full_name,
        v_first_name,
        v_last_name,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        full_name = EXCLUDED.full_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now();

    -- 3. Link Pending Professional Invite (Safe Link logic)
    -- If an admin invited this email, a row exists in professionals. LINK IT.
    UPDATE public.professionals 
    SET 
        user_id = NEW.id,
        status = 'active', 
        updated_at = now()
    WHERE 
        email = NEW.email 
        AND user_id IS NULL;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- CRITICAL: Prevent Signup Blocking. 
        -- If profile creation fails, we logged it but allow the user creation to succeed.
        -- They will just have a missing profile (repairable), but no "Database Error".
        RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Ensure Trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
