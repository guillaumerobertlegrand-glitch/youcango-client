-- Matching Engine RPC
-- Finds best available Pros for a Service based on Skills and Priority.

CREATE OR REPLACE FUNCTION api_v1_find_best_pros(
    p_service_id UUID
)
RETURNS TABLE (
    pro_id UUID,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    skill_level TEXT,
    priority INTEGER,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- 1. Identify Organization from Service
    SELECT organization_id INTO v_org_id
    FROM public.services
    WHERE id = p_service_id;

    IF v_org_id IS NULL THEN
        RETURN; -- Service not found
    END IF;

    -- 2. Return Ranked Pros
    RETURN QUERY
    SELECT 
        p.id AS pro_id,
        p.first_name,
        p.last_name,
        p.role,
        a.skill_level,
        a.priority,
        p.status
    FROM 
        public.professionals p
    JOIN 
        public.professional_service_authorizations a ON a.professional_id = p.id
    WHERE 
        a.service_id = p_service_id
        AND a.authorized = true
        AND p.status = 'active'
        AND p.organization_id = v_org_id -- Redundant but safe
    ORDER BY 
        a.priority DESC, -- Higher priority first
        -- Qualitative Skill Sort (Expert > Advanced > Standard > Novice)
        CASE a.skill_level 
            WHEN 'expert' THEN 4 
            WHEN 'advanced' THEN 3 
            WHEN 'standard' THEN 2 
            WHEN 'novice' THEN 1 
            ELSE 0 
        END DESC,
        p.first_name ASC;
END;
$$;
