-- Trigger to automatically set payment_status to 'pending' when session is completed
-- This ensures the Client UI (which might rely on payment_status) is unblocked

CREATE OR REPLACE FUNCTION public.handle_session_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if state changed to 'completed'
    IF NEW.state = 'completed' AND (OLD.state IS DISTINCT FROM 'completed') THEN
        -- Only update payment_status if it's currently 'none' or null
        -- This prevents overwriting 'paid' if it was simultaneous
        IF NEW.payment_status IS NULL OR NEW.payment_status = 'none' THEN
            NEW.payment_status := 'pending';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (BEFORE UPDATE to avoid recursion and extra writes)
DROP TRIGGER IF EXISTS tr_session_completion ON public.sessions;

CREATE TRIGGER tr_session_completion
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_session_completion();
