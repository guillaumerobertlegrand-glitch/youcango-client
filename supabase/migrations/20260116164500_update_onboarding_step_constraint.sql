-- Update onboarding_step limit to 6 (was 5)
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_onboarding_step_check;

ALTER TABLE public.organizations 
    ADD CONSTRAINT organizations_onboarding_step_check 
    CHECK (onboarding_step >= 0 AND onboarding_step <= 6);
