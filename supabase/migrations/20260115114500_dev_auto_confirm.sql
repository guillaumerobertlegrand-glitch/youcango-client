-- DEV ONLY: Auto Confirm Users
-- This trigger automatically confirms every new user upon creation.
-- Useful for Dev/Demo environments to bypass Email Verification barriers.

CREATE OR REPLACE FUNCTION public.auto_confirm_new_users() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
    UPDATE auth.users 
    SET email_confirmed_at = now() 
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

-- Drop check if exists (safeguard)
DROP TRIGGER IF EXISTS trg_auto_confirm_users ON auth.users;

-- Create Trigger
CREATE TRIGGER trg_auto_confirm_users
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_new_users();
