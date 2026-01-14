-- Fix Trigger Conflict: Allow Invite Claiming
-- Updates the `check_pro_role_assignment` function to permit updates where user_id changes from NULL to NOT NULL.
-- This allows `handle_new_user` to link a new user to an existing Admin/Editor invite without triggering "Access Denied".

CREATE OR REPLACE FUNCTION public.check_pro_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_requester_role TEXT;
    v_org_has_admin BOOLEAN;
BEGIN
    -- 0. EXCEPTION: Allow Invite Claiming / Linkage
    -- If we are just linking a user to an existing invite (user_id goes from NULL to something), allow it.
    IF TG_OP = 'UPDATE' AND OLD.user_id IS NULL AND NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

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
    -- Prevent unauthorized role escalation.
    
    IF NEW.role IN ('admin', 'editor') THEN
         -- If updating/inserting an Admin/Editor, YOU must be Admin.
         -- (Unless caught by exception above).
         IF v_requester_role != 'admin' THEN
             RAISE EXCEPTION 'Access Denied: Only Admins can assign Admin/Editor roles.';
         END IF;
    END IF;

    RETURN NEW;
END;
$$;
