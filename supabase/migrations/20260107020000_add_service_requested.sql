
-- 1. Add column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS service_requested TEXT;

-- 2. Update RPC to accept p_service_requested
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_client_id UUID,
    p_organization_id UUID,
    p_slot_id UUID,
    p_location_id UUID,
    p_service_requested TEXT DEFAULT NULL, -- New Parameter
    p_estimated_arrival_duration INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_new_session JSONB;
BEGIN
    -- Create the session
    INSERT INTO public.sessions (
        client_id,
        organization_id,
        slot_id,
        location_id,
        state,
        service_requested, -- Insert new column
        estimated_arrival_duration,
        created_at
    ) VALUES (
        p_client_id,
        p_organization_id,
        p_slot_id,
        p_location_id,
        'requested',
        COALESCE(p_service_requested, 'Service'), -- Fallback
        p_estimated_arrival_duration,
        NOW()
    )
    RETURNING id INTO v_session_id;

    -- Update slot status if provided
    IF p_slot_id IS NOT NULL THEN
        UPDATE public.slots
        SET status = 'reserved'
        WHERE id = p_slot_id;
    END IF;

    -- Return the created session
    SELECT jsonb_build_object(
        'id', s.id,
        'state', s.state,
        'service_requested', s.service_requested,
        'organization_id', s.organization_id
    ) INTO v_new_session
    FROM public.sessions s
    WHERE s.id = v_session_id;

    RETURN v_new_session;
END;
$$;
