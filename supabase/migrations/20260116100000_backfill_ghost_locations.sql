-- Backfill Locations for Organizations that missed the bootstrap logic
-- This fixes the issue for accounts created during the "gap" period.

INSERT INTO public.locations (
    organization_id,
    name,
    address,
    coordinates
)
SELECT 
    o.id,
    'Siège Social (Backfill)',
    'Adresse inconnue',
    ST_SetSRID(ST_MakePoint(2.3522 + (random()*0.02 - 0.01), 48.8566 + (random()*0.02 - 0.01)), 4326)::geography -- Random jitter around Paris
FROM 
    public.organizations o
WHERE 
    NOT EXISTS (
        SELECT 1 FROM public.locations l WHERE l.organization_id = o.id
    );
