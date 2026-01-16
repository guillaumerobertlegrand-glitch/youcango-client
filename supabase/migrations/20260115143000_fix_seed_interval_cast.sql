-- Fix Seed Services Interval Cast
-- Previous version failed with "expression is of type text" for estimated_duration.
-- Use ::INTERVAL cast.

CREATE OR REPLACE FUNCTION api_v1_seed_initial_services(
    p_org_id UUID,
    p_specialty_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template JSONB;
    v_item JSONB;
BEGIN
    -- Get Template
    SELECT catalog_template INTO v_template
    FROM public.config_specialties
    WHERE id = p_specialty_id;

    IF v_template IS NULL OR jsonb_array_length(v_template) = 0 THEN
        RETURN;
    END IF;

    -- Loop and Insert
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_template)
    LOOP
        INSERT INTO public.services (
            organization_id,
            designation,
            estimated_duration,
            price,
            active
        ) VALUES (
            p_org_id,
            v_item->>'title',
            (v_item->>'duration')::INTERVAL, -- Explicit Cast
            (v_item->>'price')::NUMERIC,
            true
        );
    END LOOP;
END;
$$;
