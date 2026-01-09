-- Add phone and image_url columns to organizations table

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.organizations.phone IS 'Contact phone number for the organization';
COMMENT ON COLUMN public.organizations.image_url IS 'URL to the organization main image/avatar';
