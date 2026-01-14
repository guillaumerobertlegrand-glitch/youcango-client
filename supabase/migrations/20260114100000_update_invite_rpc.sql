-- RPC: Update Invite Editor to Support Roles
-- Updates api_v1_invite_editor to accept p_role.

CREATE OR REPLACE FUNCTION api_v1_invite_editor(
    p_org_id UUID,
    p_email TEXT,
    p_first_name TEXT DEFAULT 'Invited',
    p_last_name TEXT DEFAULT 'User',
    p_role TEXT DEFAULT 'editor'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_requester_role TEXT;
    v_new_pro_id UUID;
BEGIN
    -- 1. Security Check (Admin Only)
    v_requester_role := public.get_my_role();
    IF v_requester_role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Only Admins can invite team members.');
    END IF;

    -- 2. Validate Role
    IF p_role NOT IN ('admin', 'editor', 'user') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid Role. Must be admin, editor, or user.');
    END IF;

    -- 3. Check if email already exists in this org
    IF EXISTS (SELECT 1 FROM public.professionals WHERE organization_id = p_org_id AND email = p_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'User with this email already exists in organization.');
    END IF;

    -- 4. Insert Pending Pro
    INSERT INTO public.professionals (
        organization_id,
        role,
        status,
        email,
        first_name,
        last_name
    ) VALUES (
        p_org_id,
        p_role,
        'pending_invite',
        p_email,
        p_first_name,
        p_last_name
    )
    RETURNING id INTO v_new_pro_id;

    RETURN jsonb_build_object(
        'success', true,
        'pro_id', v_new_pro_id,
        'message', 'Team member invited successfully.'
    );
END;
$$;
