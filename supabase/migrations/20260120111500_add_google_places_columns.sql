-- Add Google Places metadata columns to organizations
-- Reference: User Request 5.26 "Zero Friction"

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.organizations.latitude IS 'Cached Latitude from Google Places/Input';
COMMENT ON COLUMN public.organizations.longitude IS 'Cached Longitude from Google Places/Input';
COMMENT ON COLUMN public.organizations.google_place_id IS 'Link to Google Place ID';
