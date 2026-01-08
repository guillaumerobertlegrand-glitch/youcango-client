-- Seed Rennes Merchant (Florist) for Delayed Scenario
-- Requires 'merchant' business_type to allow 'delayed' intent.

INSERT INTO public.organizations (id, name, business_type, description, slug)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Fleurs de Rennes', 'merchant', 'Artisan Fleuriste', 'fleurs-rennes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.locations (id, organization_id, name, address, latitude, longitude)
VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Fleurs de Rennes Centre', 'Place de la Mairie, Rennes', 48.1113, -1.6800)
ON CONFLICT (id) DO NOTHING;
