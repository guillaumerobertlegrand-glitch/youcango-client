-- Seed Data for Pro Architecture Demo

DO $$
DECLARE
    v_org_id UUID;
    v_manager_id UUID;
    v_staff_id UUID;
    v_service_cut UUID;
    v_service_beard UUID;
    v_service_shave UUID;
BEGIN
    -- 1. Create Organization & Location
    INSERT INTO public.organizations (name, business_type, category, status, wifi_ssid)
    VALUES ('The Dandy Barber', 'service', 'barber', 'active', 'DandyGuest_Free')
    RETURNING id INTO v_org_id;

    INSERT INTO public.locations (organization_id, name, address, coordinates)
    VALUES (v_org_id, 'Main Shop', '12 Rue de la Paix, Paris', ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography);

    -- 2. Create Professionals
    INSERT INTO public.professionals (organization_id, first_name, last_name, role, status)
    VALUES (v_org_id, 'Jean', 'Dujardin', 'manager', 'active')
    RETURNING id INTO v_manager_id;

    INSERT INTO public.professionals (organization_id, first_name, last_name, role, status)
    VALUES (v_org_id, 'Paul', 'Pogba', 'staff', 'active')
    RETURNING id INTO v_staff_id;

    -- 3. Create Services
    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES 
    (v_org_id, 'Classic Haircut', 'Scissors only, traditional style.', 30, 45, 35.00, '€€', true) RETURNING id INTO v_service_cut;

    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES 
    (v_org_id, 'Beard Trim', 'Clipper work and lineup.', 15, 20, 20.00, '€', true) RETURNING id INTO v_service_beard;

    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES 
    (v_org_id, 'Royal Shave', 'Hot towel, straight razor.', 45, 60, 50.00, '€€€', true) RETURNING id INTO v_service_shave;

    -- 4. Authorizations (Habilitations)
    -- Jean (Manager) can do everything
    INSERT INTO public.professional_service_authorizations (professional_id, service_id, authorized, skill_level) VALUES
    (v_manager_id, v_service_cut, true, 'expert'),
    (v_manager_id, v_service_beard, true, 'expert'),
    (v_manager_id, v_service_shave, true, 'expert');

    -- Paul (Staff) can only do Cut and Beard
    INSERT INTO public.professional_service_authorizations (professional_id, service_id, authorized, skill_level) VALUES
    (v_staff_id, v_service_cut, true, 'standard'),
    (v_staff_id, v_service_beard, true, 'advanced');
    -- Paul is NOT authorized for Royal Shave

    -- 5. Create Slots (Availability for Today)
    -- Jean has some slots
    INSERT INTO public.slots (organization_id, service_id, professional_id, start_time, end_time, status) VALUES
    (v_org_id, v_service_cut, v_manager_id, now() + interval '1 hour', now() + interval '1 hour 30 minutes', 'free'),
    (v_org_id, v_service_shave, v_manager_id, now() + interval '2 hours', now() + interval '2 hours 45 minutes', 'free');

    -- Paul has slots
    INSERT INTO public.slots (organization_id, service_id, professional_id, start_time, end_time, status) VALUES
    (v_org_id, v_service_cut, v_staff_id, now() + interval '30 minutes', now() + interval '1 hour', 'free'),
    (v_org_id, v_service_beard, v_staff_id, now() + interval '1 hour', now() + interval '1 hour 15 minutes', 'free');

END $$;
