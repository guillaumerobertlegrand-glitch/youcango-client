-- Add Onboarding State to Organizations
-- Tracks progress through the 4-step wizard.

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 4),
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'in_progress' CHECK (onboarding_status IN ('in_progress', 'completed'));

-- Index for analytics (optional but good)
CREATE INDEX IF NOT EXISTS idx_org_onboarding_status ON public.organizations(onboarding_status);
