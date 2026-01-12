-- RPC: Set Pro Presence (Device Aware)

-- 1. Add Location Tracking to Devices
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- 2. The RPC
CREATE OR REPLACE FUNCTION api_v1_set_pro_presence(
    p_status TEXT, -- 'active' or 'inactive'
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_long DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pro_id UUID;
    v_org_id UUID;
    v_org_lat DOUBLE PRECISION;
    v_org_long DOUBLE PRECISION;
    v_device_id UUID;
    v_device_type public.device_type;
    v_distance DOUBLE PRECISION;
BEGIN
    -- 1. Get Context
    SELECT id, organization_id INTO v_pro_id, v_org_id
    FROM public.professionals
    WHERE user_id = auth.uid();

    IF v_pro_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Professional profile not found for user');
    END IF;

    -- 2. Handle 'inactive' (Simple)
    IF p_status = 'inactive' THEN
        UPDATE public.professionals SET status = 'inactive' WHERE id = v_pro_id;
        RETURN jsonb_build_object('success', true, 'status', 'inactive');
    END IF;

    -- 3. Handle 'active' -> Device Check
    -- Get highest priority active device (e.g., limit 1, ordering by some logic or just ANY active)
    SELECT id, type INTO v_device_id, v_device_type
    FROM public.devices
    WHERE pro_id = v_pro_id AND status = 'active'
    ORDER BY created_at DESC -- Prefer newest assigned
    LIMIT 1;

    IF v_device_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active device assigned. Cannot go online.');
    END IF;

    -- 4. Device Type Logic
    IF v_device_type IN ('tablet', 'pc') THEN
        -- STATIC CHECK (Geofence)
        
        -- Get Org Location
        SELECT ST_Y(coordinates::geometry), ST_X(coordinates::geometry) INTO v_org_lat, v_org_long
        FROM public.locations
        WHERE organization_id = v_org_id
        LIMIT 1; -- Taking primary location

        IF v_org_lat IS NULL THEN
             RETURN jsonb_build_object('success', false, 'error', 'Organization has no location set.');
        END IF;

        IF p_lat IS NULL OR p_long IS NULL THEN
             RETURN jsonb_build_object('success', false, 'error', 'Location required for Static Device activation.');
        END IF;

        -- Calculate Distance (Haversine approx via PostGIS)
        SELECT ST_Distance(
            ST_SetSRID(ST_MakePoint(p_long, p_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_org_long, v_org_lat), 4326)::geography
        ) INTO v_distance;

        IF v_distance > 150 THEN -- 150m Radius tolerance
            RETURN jsonb_build_object('success', false, 'error', 'Device too far from Organization (' || round(v_distance::numeric, 0) || 'm). Must be on-site.');
        END IF;

    ELSE 
        -- DYNAMIC CHECK (Phone/Watch/Wearable)
        -- Just update location, allow activation (Nomad mode)
        -- (Ideally we track this in a history table, but for MVP update device state)
    END IF;

    -- 5. Success Execution
    -- Update Device Tracking
    UPDATE public.devices
    SET 
        last_latitude = p_lat,
        last_longitude = p_long,
        last_seen_at = now()
    WHERE id = v_device_id;

    -- Set Pro Active
    UPDATE public.professionals 
    SET status = 'active' 
    WHERE id = v_pro_id;

    RETURN jsonb_build_object(
        'success', true, 
        'status', 'active', 
        'device_used', v_device_type,
        'distance_check', CASE WHEN v_device_type IN ('tablet', 'pc') THEN v_distance ELSE NULL END
    );
END;
$$;
