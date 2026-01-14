-- Remove Zombie Trigger and Function
-- These referenced columns (stripe_account_id) that no longer exist on organizations table.

DROP TRIGGER IF EXISTS trg_protect_stripe_columns ON public.organizations;
DROP FUNCTION IF EXISTS public.check_stripe_update_permission();
