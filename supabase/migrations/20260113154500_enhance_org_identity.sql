-- Enhance Organization Identity
-- Source of Truth: SIRET

-- 1. Add Columns
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS siret TEXT,
ADD COLUMN IF NOT EXISTS official_name TEXT,
ADD COLUMN IF NOT EXISTS ape_code TEXT;

-- 2. Constraints
-- SIRET should be unique if present
ALTER TABLE public.organizations 
ADD CONSTRAINT organizations_siret_key UNIQUE (siret);

-- 3. Comments for Clarity
COMMENT ON COLUMN public.organizations.name IS 'Commercial Name (Enseigne) used for display/marketing.';
COMMENT ON COLUMN public.organizations.official_name IS 'Legal Name (Raison Sociale) linked to SIRET.';
COMMENT ON COLUMN public.organizations.siret IS 'Unique French Business Identifier (14 digits).';
