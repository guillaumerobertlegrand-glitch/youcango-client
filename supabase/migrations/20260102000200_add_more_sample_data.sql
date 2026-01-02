-- New sample data for advanced testing
-- Locations around Bastille, Ile de la Cité, Les Halles, Rue des Écoles, and Le Marais

DO $$
DECLARE
    v_org_id UUID;
BEGIN
    -- 1. Restaurants (merchant category for purchase, or service for booking? Usually merchant for food but lets use merchant)
    -- Restaurant Bastille
    INSERT INTO public.organizations (name, business_type, category) 
    VALUES ('Bistro de la Bastille', 'merchant', 'restaurant') RETURNING id INTO v_org_id;
    INSERT INTO public.locations (organization_id, name, address, coordinates) 
    VALUES (v_org_id, 'Bastille Branch', 'Place de la Bastille, 75011 Paris', ST_SetSRID(ST_MakePoint(2.3698, 48.8530), 4326)::geography);

    -- Restaurant Ile de la Cité
    INSERT INTO public.organizations (name, business_type, category) 
    VALUES ('L''Oiseau de Seine', 'merchant', 'restaurant') RETURNING id INTO v_org_id;
    INSERT INTO public.locations (organization_id, name, address, coordinates) 
    VALUES (v_org_id, 'Cité Branch', 'Quai de l''Horloge, 75001 Paris', ST_SetSRID(ST_MakePoint(2.3450, 48.8560), 4326)::geography);

    -- Restaurant Les Halles
    INSERT INTO public.organizations (name, business_type, category) 
    VALUES ('Le Grand Burger Halles', 'merchant', 'restaurant') RETURNING id INTO v_org_id;
    INSERT INTO public.locations (organization_id, name, address, coordinates) 
    VALUES (v_org_id, 'Halles Branch', 'Forum des Halles, 75001 Paris', ST_SetSRID(ST_MakePoint(2.3458, 48.8619), 4326)::geography);

    -- 2. Another bakery (Rue des Écoles)
    INSERT INTO public.organizations (name, business_type, category) 
    VALUES ('La fournée des Écoles', 'merchant', 'bakery') RETURNING id INTO v_org_id;
    INSERT INTO public.locations (organization_id, name, address, coordinates) 
    VALUES (v_org_id, 'Quartier Latin branch', '45 Rue des Écoles, 75005 Paris', ST_SetSRID(ST_MakePoint(2.3468, 48.8496), 4326)::geography);

    -- 3. Beauty Salon (Le Marais) - category: 'service'
    INSERT INTO public.organizations (name, business_type, category) 
    VALUES ('Éclat du Marais', 'service', 'beauty_salon') RETURNING id INTO v_org_id;
    INSERT INTO public.locations (organization_id, name, address, coordinates) 
    VALUES (v_org_id, 'Marais branch', 'Rue de Turenne, 75003 Paris', ST_SetSRID(ST_MakePoint(2.3638, 48.8596), 4326)::geography);

END $$;
