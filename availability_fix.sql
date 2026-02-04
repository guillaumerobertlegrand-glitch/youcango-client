-- FIX SCRIPT: Force Availability for Map Visibility
-- Target: All Organizations, specifically the 11 new ones.

BEGIN;

-- 1. Ensure all Professionals are Active & Available
UPDATE public.professionals
SET status = 'active', availability_status = 'available'
WHERE status != 'active' OR availability_status != 'available';

-- 2. Ensure every Organization has at least one default Service (required for Slots)
INSERT INTO public.services (organization_id, title, duration_min, duration_max, price_amount, active)
SELECT 
    id, 
    'Consultation Standard', 
    30, 
    60, 
    50.00, 
    true
FROM public.organizations
WHERE id NOT IN (SELECT organization_id FROM public.services)
ON CONFLICT DO NOTHING;

-- 3. Create 'Open' Slots for TODY (Paris Time)
-- We insert a slot from NOW to NOW+3h for every active professional.
-- This ensures they show up if the map filters by "Currently Open".

INSERT INTO public.slots (
    organization_id,
    service_id,
    professional_id,
    start_time,
    end_time,
    status
)
SELECT 
    p.organization_id,
    (SELECT id FROM public.services s WHERE s.organization_id = p.organization_id LIMIT 1),
    p.id,
    NOW(), -- Starts Now
    NOW() + INTERVAL '4 hours', -- Ends in 4 hours
    'free'
FROM public.professionals p
WHERE NOT EXISTS (
    SELECT 1 FROM public.slots s 
    WHERE s.professional_id = p.id 
    AND s.status = 'free'
    AND s.end_time > NOW()
);

-- 4. Check/Fix Coordinates (Force Paris Center if missing/zero)
-- 11 Establishments implies we want them visible on the "Hotel de Ville" map.
UPDATE public.locations
SET coordinates = ST_SetSRID(ST_MakePoint(2.3522 + (random() * 0.01 - 0.005), 48.8566 + (random() * 0.01 - 0.005)), 4326)::geography
WHERE 
    organization_id IN (SELECT id FROM public.organizations WHERE created_at > NOW() - INTERVAL '24 hours')
    AND (ST_X(coordinates::geometry) = 0 OR ST_Y(coordinates::geometry) = 0);

COMMIT;
