-- RPC: Remove Team Member
-- Allows an Admin to remove a professional from their organization.
-- Cleans up device assignments and service authorizations.

CREATE OR REPLACE FUNCTION api_v1_remove_team_member(
    p_pro_id UUID,
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_executer_role TEXT;
    v_target_user_id UUID;
BEGIN
    -- 1. Check Permissions (Must be Admin of the Org)
    SELECT role INTO v_executer_role
    FROM public.professionals
    WHERE user_id = auth.uid() AND organization_id = p_org_id;

    IF v_executer_role IS NULL OR v_executer_role <> 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Admins can remove members.');
    END IF;

    -- 2. Identify Target
    SELECT user_id INTO v_target_user_id
    FROM public.professionals
    WHERE id = p_pro_id AND organization_id = p_org_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Member not found.');
    END IF;

    -- 3. Prevent Self-Deletion (Optional, but safer for UI consistency)
    IF v_target_user_id = auth.uid() THEN
         RETURN jsonb_build_object('success', false, 'error', 'Cannot remove yourself. Use "Leave Organization" instead.');
    END IF;

    -- 4. Cleanup Logic
    -- Unassign Devices
    UPDATE public.devices
    SET pro_id = NULL, status = 'inactive'
    WHERE pro_id = p_pro_id AND organization_id = p_org_id;

    -- Remove Service Authorizations
    DELETE FROM public.professional_service_authorizations
    WHERE professional_id = p_pro_id;

    -- Remove Professional
    DELETE FROM public.professionals
    WHERE id = p_pro_id;

    RETURN jsonb_build_object('success', true, 'message', 'Member removed successfully.');
END;
$$;
