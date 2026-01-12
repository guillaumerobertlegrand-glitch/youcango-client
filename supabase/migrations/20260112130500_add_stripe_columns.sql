-- Add Stripe Columns to Organizations
-- Protected columns for Admin use only (Finance)

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_status TEXT CHECK (stripe_status IN ('pending', 'active', 'restricted', 'disabled'));

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_org_stripe_id ON public.organizations(stripe_account_id);
