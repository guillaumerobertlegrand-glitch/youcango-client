-- Trigger to link Pro and activate upon Signup/Invite acceptance
-- V3: Case Insensitive Logic (Robustness Fix)

CREATE OR REPLACE FUNCTION public.handle_invite_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If the user check is confirmed (has a timestamp)
    IF NEW.email_confirmed_at IS NOT NULL THEN
        -- Link and Activate any pending professional with this email (Case Insensitive)
        UPDATE public.professionals
        SET 
            user_id = NEW.id,
            status = 'active'
        WHERE LOWER(email) = LOWER(NEW.email)
          AND (status = 'pending_invite' OR user_id IS NULL);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invite_acceptance ON auth.users;

CREATE TRIGGER on_invite_acceptance
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_invite_acceptance();
