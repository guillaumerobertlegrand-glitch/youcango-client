-- Relax Onboarding Step Constraint
-- Originally limited to 1-4. We need 5 for "Completed" state.

ALTER TABLE public.organizations
DROP CONSTRAINT IF EXISTS organizations_onboarding_step_check;

ALTER TABLE public.organizations
ADD CONSTRAINT organizations_onboarding_step_check 
CHECK (onboarding_step BETWEEN 1 AND 5);
