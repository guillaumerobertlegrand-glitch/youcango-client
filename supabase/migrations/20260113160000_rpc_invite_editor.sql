-- RPC: Invite Editor
-- Creates a pending Pro record for invitation.

-- 1. Add Email Column for Invitations
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Add 'pending_invite' status
-- (Assuming constraints allow it. We had CHECK (status IN ('active', 'inactive')). We need to update this.)
ALTER TABLE public.professionals DROP CONSTRAINT IF EXISTS professionals_status_check;
ALTER TABLE public.professionals ADD CONSTRAINT professionals_status_check CHECK (status IN ('active', 'inactive', 'pending_invite'));


-- 3. The RPC
CREATE OR REPLACE FUNCTION api_v1_invite_editor(
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
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Only Admins can invite editors.');
    END IF;

    -- 2. Check if email already exists in this org
    IF EXISTS (SELECT 1 FROM public.professionals WHERE organization_id = p_org_id AND email = p_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'User with this email already exists in organization.');
    END IF;

    -- 3. Insert Pending Pro
    INSERT INTO public.professionals (
        organization_id,
        role,
        status,
        email,
        first_name,
        last_name
    ) VALUES (
        p_org_id,
        'editor',
        'pending_invite',
        p_email,
        p_first_name,
        p_last_name
    )
    RETURNING id INTO v_new_pro_id;

    RETURN jsonb_build_object(
        'success', true,
        'pro_id', v_new_pro_id,
        'message', 'Editor invited successfully. Pending acceptance.'
    );
END;
$$;
