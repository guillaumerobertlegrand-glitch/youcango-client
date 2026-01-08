-- Seed Data for Rennes Restaurants (Merchant Scenarios)

DO $$
DECLARE
    v_org_id UUID;
    v_loc_id UUID;
    v_service_id UUID;
    v_staff_id UUID;
    rennes_lat FLOAT := 48.1173;
    rennes_long FLOAT := -1.6778;
BEGIN
    -- 1. "Le Galopin" (Restaurant Classique)
    INSERT INTO public.organizations (name, business_type, category, status, wifi_ssid)
    VALUES ('Le Galopin', 'merchant', 'restaurant', 'active', 'Galopin_Guest')
    RETURNING id INTO v_org_id;

    INSERT INTO public.locations (organization_id, name, address, coordinates)
    VALUES (v_org_id, 'Centre-Ville', '21 Avenue Janvier, Rennes', ST_SetSRID(ST_MakePoint(rennes_long + 0.002, rennes_lat - 0.001), 4326)::geography)
    RETURNING id INTO v_loc_id;

    -- Create a Service/Item for booking context
    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES (v_org_id, 'Table de 2', 'Réservation standard', 60, 90, 0.00, '€€', true)
    RETURNING id INTO v_service_id;
    
    -- Create dummy staff/slots for "Locking" to work (MapWrapper looks for free slots)
    INSERT INTO public.professionals (organization_id, first_name, last_name, role, status)
    VALUES (v_org_id, 'Equipe', 'Salle', 'staff', 'active') RETURNING id INTO v_staff_id;

    INSERT INTO public.slots (organization_id, service_id, professional_id, start_time, end_time, status) VALUES
    (v_org_id, v_service_id, v_staff_id, now(), now() + interval '12 hours', 'free');


    -- 2. "L''Ambassade" (Restaurant Chic)
    INSERT INTO public.organizations (name, business_type, category, status, wifi_ssid)
    VALUES ('L''Ambassade', 'merchant', 'restaurant', 'active', 'Ambassade_VIP')
    RETURNING id INTO v_org_id;

    INSERT INTO public.locations (organization_id, name, address, coordinates)
    VALUES (v_org_id, 'Gare', '18 Place de la Gare, Rennes', ST_SetSRID(ST_MakePoint(rennes_long - 0.003, rennes_lat + 0.002), 4326)::geography);
    -- Add slots similarly (simplified)
    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES (v_org_id, 'Table', 'Réservation', 60, 90, 0.00, '€€€', true) RETURNING id INTO v_service_id;
    INSERT INTO public.slots (organization_id, service_id, professional_id, start_time, end_time, status) VALUES
    (v_org_id, v_service_id, NULL, now(), now() + interval '12 hours', 'free'); -- NULL staff might be ok if no constraint


    -- 3. "Crêperie Sainte-Anne" (Locale)
    INSERT INTO public.organizations (name, business_type, category, status, wifi_ssid)
    VALUES ('Crêperie Sainte-Anne', 'merchant', 'restaurant', 'active', 'Crepe_Free')
    RETURNING id INTO v_org_id;

    INSERT INTO public.locations (organization_id, name, address, coordinates)
    VALUES (v_org_id, 'Sainte-Anne', '5 Place Sainte-Anne, Rennes', ST_SetSRID(ST_MakePoint(rennes_long + 0.001, rennes_lat + 0.003), 4326)::geography);
    -- Add slots
    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES (v_org_id, 'Table', 'Galettes', 45, 60, 0.00, '€', true) RETURNING id INTO v_service_id;
    INSERT INTO public.slots (organization_id, service_id, professional_id, start_time, end_time, status) VALUES
    (v_org_id, v_service_id, NULL, now(), now() + interval '12 hours', 'free');

END $$;
