-- Fix Assign Device RPC
-- Previous version used 'unused' status which violated constraints.
-- Updated to use 'inactive'.

CREATE OR REPLACE FUNCTION api_v1_assign_device_to_pro(
    p_pro_id UUID,
    p_device_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_requester_role TEXT;
BEGIN
    -- 1. Security Check
    v_requester_role := public.get_my_role();
    IF v_requester_role NOT IN ('admin', 'editor') THEN
         RETURN jsonb_build_object('success', false, 'error', 'Permission Denied');
    END IF;

    -- 2. Validate Pro exists and belongs to same Org
    SELECT organization_id INTO v_org_id FROM public.professionals WHERE id = p_pro_id;
    
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Professional not found');
    END IF;

    -- 3. Release Device from other pros (if any)
    -- Sets status to 'inactive' to respect ENUM/Constraint
    UPDATE public.devices SET pro_id = NULL, status = 'inactive' 
    WHERE id = p_device_id AND organization_id = v_org_id;

    -- 4. Assign Device
    UPDATE public.devices 
    SET pro_id = p_pro_id, status = 'active'
    WHERE id = p_device_id AND organization_id = v_org_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
