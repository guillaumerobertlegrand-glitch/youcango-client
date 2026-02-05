CREATE OR REPLACE FUNCTION api_create_org_v4(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    p_org_name TEXT := payload->>'p_org_name';
    p_first_name TEXT := payload->>'p_first_name';
    p_last_name TEXT := payload->>'p_last_name';
    p_job_title TEXT := payload->>'p_job_title';
    p_siret TEXT := payload->>'p_siret';
    p_official_name TEXT := payload->>'p_official_name';
    p_ape_code TEXT := payload->>'p_ape_code';
    p_specialty_id TEXT := payload->>'p_specialty_id';
    
    p_address TEXT := payload->>'p_address';
    p_lat FLOAT := (payload->>'p_lat')::FLOAT;
    p_long FLOAT := (payload->>'p_long')::FLOAT;
    
    p_google_place_id TEXT := payload->>'p_google_place_id';
    p_opening_hours JSONB := COALESCE(payload->'p_opening_hours', '{}'::jsonb);
    p_photos JSONB := COALESCE(payload->'p_photos', '[]'::jsonb);
    p_website TEXT := payload->>'p_website';
    
    -- INJECTED CLASSIFICATION (Source of Truth: ape_mappings lookups in client)
    -- We expect the client to have validated this against public.ape_mappings
    p_business_type TEXT := payload->>'p_business_type';
    p_category TEXT := payload->>'p_category';
    
    v_org_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Safety Check
    IF p_business_type IS NULL OR p_category IS NULL THEN
         RAISE EXCEPTION 'Classification manquante (Business Type/Category). Code APE non reconnu ou non mappé.';
    END IF;
    
    -- 1. Create Organization
    INSERT INTO public.organizations (
        name, 
        official_name, 
        siret, 
        ape_code, 
        business_type, 
        category,
        onboarding_step,
        specialty_id,
        latitude,
        longitude,
        google_place_id,
        opening_hours,
        photos,
        website_url
    )
    VALUES (
        p_org_name, 
        p_official_name, 
        p_siret, 
        p_ape_code, 
        p_business_type,
        p_category,
        1,
        p_specialty_id,
        p_lat,
        p_long,
        p_google_place_id,
        p_opening_hours,
        p_photos,
        p_website
    ) 
    RETURNING id INTO v_org_id;

    -- Return the new ID
    RETURN jsonb_build_object('organization_id', v_org_id);
END;
$$;
