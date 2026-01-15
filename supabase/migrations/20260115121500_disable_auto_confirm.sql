-- Revert Auto Confirm Users (Restore Production Flow)
-- Drops the trigger and function that automatically confirmed emails.

DROP TRIGGER IF EXISTS trg_auto_confirm_users ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_new_users;
