-- Secure Pro Creation/Update
-- Prevent Privilege Escalation (Only Admins create Admins/Editors)

CREATE OR REPLACE FUNCTION public.check_pro_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_requester_role TEXT;
    v_org_has_admin BOOLEAN;
BEGIN
    -- 1. Get Requester Role
    -- If triggered by direct SQL from authenticated user
    IF auth.uid() IS NULL THEN
        -- System/Seed bypass -> Allow
        RETURN NEW;
    END IF;

    v_requester_role := public.get_my_role(); -- Helper we created earlier

    -- 2. Check if Org is in Bootstrapping Mode (0 Admins)
    SELECT EXISTS (
        SELECT 1 FROM public.professionals 
        WHERE organization_id = NEW.organization_id AND role = 'admin'
    ) INTO v_org_has_admin;

    -- 3. Logic
    IF NOT v_org_has_admin THEN
        -- BOOTSTRAPPING: Allow creation of the FIRST Admin
        IF NEW.role = 'admin' THEN
            -- Allow First Admin
            RETURN NEW; 
        END IF;
    END IF;

    -- 4. Normal Operation: Requester MUST be Admin to assign roles other than 'user'
    -- Or logic: Only Admin can CREATE/UPDATE other pros.
    -- (Strict Policy: Manager/Editor can manage 'user' pros? Plan said Editor = Ops Manager)
    -- Simplification for Step 1: Just ensure Admin rights for Admin creation.

    IF NEW.role IN ('admin', 'editor') AND v_requester_role != 'admin' THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can assign Admin/Editor roles.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_secure_pro_creation
BEFORE INSERT OR UPDATE ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.check_pro_role_assignment();
