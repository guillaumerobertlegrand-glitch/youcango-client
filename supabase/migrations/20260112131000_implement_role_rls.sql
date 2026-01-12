-- Implement Role-Based Security
-- PROTECT FINANCE DATA & ENFORCE HIERARCHY

-- 1. Helper Function to get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.professionals
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    RETURN COALESCE(v_role, 'user'); -- Default to user if not found
END;
$$;

-- 2. Protect Stripe Columns (Write Access) via Trigger
CREATE OR REPLACE FUNCTION public.check_stripe_update_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If Stripe columns are being modified
    IF (NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id) OR
       (NEW.stripe_status IS DISTINCT FROM OLD.stripe_status) THEN
       
        -- Check if user is admin
        IF public.get_my_role() != 'admin' THEN
            RAISE EXCEPTION 'Access Denied: Only Admins can modify Financial Data.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_stripe_columns
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.check_stripe_update_permission();


-- 3. RLS for Devices
-- Admin/Editor: Full Access
-- User: Read Only (or manage own if we link device to specific pro, but user=staff usually just uses them)
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Editors manage devices" ON public.devices;
CREATE POLICY "Admins and Editors manage devices"
ON public.devices
FOR ALL
USING (
    public.get_my_role() IN ('admin', 'editor')
);

DROP POLICY IF EXISTS "Users view devices" ON public.devices;
CREATE POLICY "Users view devices"
ON public.devices
FOR SELECT
USING (
    public.get_my_role() = 'user'
);

-- 4. RLS for Authorizations
-- Admin/Editor: Full Access
-- User: Read Only (View their own skills or others?) -> View All for transparency in team
ALTER TABLE public.professional_service_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Editors manage authorizations" ON public.professional_service_authorizations;
CREATE POLICY "Admins and Editors manage authorizations"
ON public.professional_service_authorizations
FOR ALL
USING (
    public.get_my_role() IN ('admin', 'editor')
);

DROP POLICY IF EXISTS "Users view authorizations" ON public.professional_service_authorizations;
CREATE POLICY "Users view authorizations"
ON public.professional_service_authorizations
FOR SELECT
USING (true); -- Open read for team
