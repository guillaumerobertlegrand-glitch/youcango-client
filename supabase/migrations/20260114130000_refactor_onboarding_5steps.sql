-- Refactor Onboarding to 5 Steps
-- Step 1: Identity (SIRET, Name)
-- Step 2: Finance (Stripe)
-- Step 3: Catalog (Services)
-- Step 4: Team & Tools (Pros + Devices + Skills)
-- Step 5: Ready (Final Check)

CREATE OR REPLACE FUNCTION api_v1_validate_onboarding_step(
    p_step INTEGER,
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_valid BOOLEAN := FALSE;
    v_details JSONB;
BEGIN
    CASE p_step
        WHEN 1 THEN
            -- Step 1: IDENTITY
            -- Req: SIRET, Official Name, APE
            SELECT (siret IS NOT NULL AND official_name IS NOT NULL)
            INTO v_is_valid
            FROM public.organizations WHERE id = p_org_id;
            
            v_details := jsonb_build_object('has_identity', v_is_valid);

        WHEN 2 THEN
            -- Step 2: FINANCE
            -- Req: Stripe Account ID must be present (mock or real)
            -- We check organization_secrets table if it exists, or just the fact that it's linked.
            -- For MVP/Demo: Check existence of secret row or flag.
            
            -- Assuming we link via 'organization_secrets' table or simply check for now:
            SELECT EXISTS (
                SELECT 1 FROM public.organization_secrets 
                WHERE organization_id = p_org_id 
                AND stripe_account_id IS NOT NULL
            ) INTO v_is_valid;

            v_details := jsonb_build_object('has_stripe', v_is_valid);

        WHEN 3 THEN
            -- Step 3: CATALOG (Services)
            -- Req: At least 1 active Service
            SELECT EXISTS (
                SELECT 1 FROM public.services
                WHERE organization_id = p_org_id 
                AND active = true
            ) INTO v_is_valid;
            
            v_details := jsonb_build_object('has_services', v_is_valid);

        WHEN 4 THEN
            -- Step 4: TEAM & TOOLS
            -- Req:
            -- 1. At least 1 active Admin.
            -- 2. ALL active Pros must have a Device assigned.
            -- 3. Skills Matrix populated (at least 1 auth per pro? Optional but good).
            
            DECLARE
                v_has_admin BOOLEAN;
                v_all_equipped BOOLEAN;
            BEGIN
                -- Check Admin
                SELECT EXISTS (
                    SELECT 1 FROM public.professionals 
                    WHERE organization_id = p_org_id AND role = 'admin' AND status = 'active'
                ) INTO v_has_admin;

                -- Check Devices (No active pro without device)
                SELECT NOT EXISTS (
                    SELECT 1 FROM public.professionals p
                    LEFT JOIN public.devices d ON d.pro_id = p.id
                    WHERE p.organization_id = p_org_id AND p.status = 'active'
                    AND d.id IS NULL
                ) INTO v_all_equipped;

                v_is_valid := v_has_admin AND v_all_equipped;
                v_details := jsonb_build_object(
                    'has_admin', v_has_admin,
                    'all_equipped', v_all_equipped
                );
            END;

        WHEN 5 THEN
            -- Step 5: READY
            -- Always valid if previous steps passed (which is enforced by Guard).
            -- This step is just a confirmation page.
            v_is_valid := TRUE;
            v_details := jsonb_build_object('ready', true);

        ELSE
            RAISE EXCEPTION 'Invalid Step Number %', p_step;
    END CASE;

    RETURN jsonb_build_object(
        'step', p_step,
        'valid', v_is_valid,
        'details', v_details
    );
END;
$$;
