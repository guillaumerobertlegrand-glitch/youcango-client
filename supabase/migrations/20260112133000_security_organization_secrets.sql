-- SECURITY SPLIT: Organization Secrets
-- Move sensitive columns to a separate table to enforce strict RLS (Admin Only).

-- 1. Create Secrets Table
CREATE TABLE IF NOT EXISTS public.organization_secrets (
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE PRIMARY KEY,
    stripe_account_id TEXT,
    stripe_status TEXT CHECK (stripe_status IN ('pending', 'active', 'restricted', 'disabled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Migrate Data (if any exists from previous migration)
INSERT INTO public.organization_secrets (organization_id, stripe_account_id, stripe_status)
SELECT id, stripe_account_id, stripe_status
FROM public.organizations
WHERE stripe_account_id IS NOT NULL;

-- 3. Cleanup Organizations Table (Drop Columns)
ALTER TABLE public.organizations
DROP COLUMN IF EXISTS stripe_account_id,
DROP COLUMN IF EXISTS stripe_status;

-- 4. RLS Policy (Strict Admin Access)
ALTER TABLE public.organization_secrets ENABLE ROW LEVEL SECURITY;

-- Only Admins can VIEW/EDIT secrets
CREATE POLICY "Admins manage organization secrets"
ON public.organization_secrets
FOR ALL
USING (
    public.get_my_role() = 'admin'
);

-- Deny everyone else (Default RLS behavior is deny if no policy, but explicit is fine)
