-- Force Re-creation of Invite Member RPC
-- Identical to previous, but ensuring it runs if the previous one was missed or failed silently.

CREATE OR REPLACE FUNCTION api_v1_invite_member(
    p_org_id UUID,
    p_email TEXT,
    p_first_name TEXT DEFAULT 'Invited',
    p_last_name TEXT DEFAULT 'User'
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
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Only Admins can invite members.');
    END IF;

    -- 2. Check if email already exists in this org
    IF EXISTS (SELECT 1 FROM public.professionals WHERE organization_id = p_org_id AND email = p_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'User with this email already exists in organization.');
    END IF;

    -- 3. Insert Pending Pro with role 'member'
    INSERT INTO public.professionals (
        organization_id,
        role,
        status,
        email,
        first_name,
        last_name
    ) VALUES (
        p_org_id,
        'member',
        'pending_invite',
        p_email,
        p_first_name,
        p_last_name
    )
    RETURNING id INTO v_new_pro_id;

    RETURN jsonb_build_object(
        'success', true,
        'pro_id', v_new_pro_id,
        'message', 'Member invited successfully. Pending acceptance.'
    );
END;
$$;

-- Grant execution explicitly just in case
GRANT EXECUTE ON FUNCTION api_v1_invite_member(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
