-- Seed 3 Florists in Rennes for the "Opportunistic" Demo

DO $$
DECLARE
    v_org_id UUID;
    v_service_id UUID;
    v_staff_id UUID;
BEGIN

    ---------------------------------------------------------------------------
    -- 1. Fleurs de Rennes (Centre)
    ---------------------------------------------------------------------------
    INSERT INTO public.organizations (id, name, business_type, category, status)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', 'Fleurs de Rennes', 'merchant', 'florist', 'active')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    INSERT INTO public.locations (id, organization_id, name, address, coordinates)
    VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', 'Centre', 'Place de la Mairie, Rennes', ST_SetSRID(ST_MakePoint(-1.6798, 48.1113), 4326)::geography)
    ON CONFLICT (id) DO NOTHING;

    -- Service: Bouquet
    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', 'Bouquet Surprise', 'Composition du moment', 10, 15, 30.00, '€€', true)
    RETURNING id INTO v_service_id;

    -- Slots
    INSERT INTO public.slots (organization_id, service_id, status, start_time, end_time)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', v_service_id, 'free', now(), now() + interval '24 hours');


    ---------------------------------------------------------------------------
    -- 2. Le Jardin de Lise (Gare)
    ---------------------------------------------------------------------------
    INSERT INTO public.organizations (id, name, business_type, category, status)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', 'Le Jardin de Lise', 'merchant', 'florist', 'active')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    INSERT INTO public.locations (id, organization_id, name, address, coordinates)
    VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', 'Gare', '18 Avenue Janvier, Rennes', ST_SetSRID(ST_MakePoint(-1.6740, 48.1060), 4326)::geography)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', 'Plante Verte', 'Plante d''intérieur', 5, 10, 25.00, '€€', true)
    RETURNING id INTO v_service_id;

    INSERT INTO public.slots (organization_id, service_id, status, start_time, end_time)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', v_service_id, 'free', now(), now() + interval '24 hours');


    ---------------------------------------------------------------------------
    -- 3. Monceau Fleurs (Sainte-Anne)
    ---------------------------------------------------------------------------
    INSERT INTO public.organizations (id, name, business_type, category, status)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', 'Monceau Fleurs', 'merchant', 'florist', 'active')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    INSERT INTO public.locations (id, organization_id, name, address, coordinates)
    VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', 'Sainte-Anne', 'Place Sainte-Anne, Rennes', ST_SetSRID(ST_MakePoint(-1.6800, 48.1145), 4326)::geography)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', 'Rose à l''unité', 'Rose rouge passion', 5, 5, 4.00, '€', true)
    RETURNING id INTO v_service_id;

    INSERT INTO public.slots (organization_id, service_id, status, start_time, end_time)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', v_service_id, 'free', now(), now() + interval '24 hours');

END $$;
