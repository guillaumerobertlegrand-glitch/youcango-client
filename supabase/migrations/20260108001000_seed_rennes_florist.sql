-- Seed Rennes Merchant (Florist) for Delayed Scenario
-- Requires 'merchant' business_type to allow 'delayed' intent.

INSERT INTO public.organizations (id, name, business_type, description)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Fleurs de Rennes', 'merchant', 'Artisan Fleuriste')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.locations (id, organization_id, name, address, coordinates)
VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Fleurs de Rennes Centre', 'Place de la Mairie, Rennes', ST_SetSRID(ST_MakePoint(-1.6800, 48.1113), 4326)::geography)
ON CONFLICT (id) DO NOTHING;
