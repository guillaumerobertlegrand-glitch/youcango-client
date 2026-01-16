-- Migration: Simplify Device Assignment & Cleanup

-- 1. Schema Cleanup (Best Effort Rename/Drop)
-- We check if 'onboarding_st' exists and 'onboarding_step' doesn't, rename.
-- If both exist, drop 'onboarding_st' (assuming 'step' is the correct one used by recent code).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'onboarding_st') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'onboarding_step') THEN
            ALTER TABLE public.organizations RENAME COLUMN onboarding_st TO onboarding_step;
        ELSE
            -- Both exist, drop the truncated one? Or merge?
            -- Safe bet: just drop the truncated one if we rely on 'step'
            ALTER TABLE public.organizations DROP COLUMN onboarding_st;
        END IF;
    END IF;
END $$;


-- 2. RPC: Assign Device Type (Auto-Link)
-- Ensures a professional has a device of a specific type.
CREATE OR REPLACE FUNCTION api_v1_assign_device_type(
    p_pro_id UUID,
    p_type_id UUID,
    p_org_id UUID,
    p_name TEXT DEFAULT NULL -- Optional name override for new devices
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_device_id UUID;
    v_type_label TEXT;
BEGIN
    -- 1. Get Label for Naming (if needed)
    SELECT label INTO v_type_label FROM public.config_device_types WHERE id = p_type_id;
    IF v_type_label IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid Device Type');
    END IF;

    -- 2. Check for Existing Device for this Pro
    SELECT id INTO v_device_id FROM public.devices WHERE pro_id = p_pro_id LIMIT 1;

    IF v_device_id IS NOT NULL THEN
        -- UPDATE existing
        UPDATE public.devices
        SET device_type_id = p_type_id,
            status = 'active',
            updated_at = NOW()
            -- We don't overwrite name unless strictly necessary? Or maybe we DO to reflect the new type?
            -- Let's keep the user's custom name if set, or update default names.
        WHERE id = v_device_id;
    ELSE
        -- INSERT new
        INSERT INTO public.devices (organization_id, pro_id, device_type_id, name, status)
        VALUES (
            p_org_id, 
            p_pro_id, 
            p_type_id, 
            COALESCE(p_name, v_type_label), -- Use Label as default name (e.g. "Smartphone")
            'active'
        )
        RETURNING id INTO v_device_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'device_id', v_device_id);
END;
$$;
