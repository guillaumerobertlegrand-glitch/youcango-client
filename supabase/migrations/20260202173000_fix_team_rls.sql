-- Fix RLS for Team Visibility
-- 1. Allow viewing profiles of the same organization (based on professionals table source of truth)
-- 2. Setup RLS for invitations table

-- A. Profiles: Allow viewing if in same organization
-- Drop existing restrictive policy if strictly "own profile" prevents seeing others
-- But "Users can view own profile" is fine to keep, we just add another OR condition or a new policy.
-- Adding a new policy is cleaner (Policies are OR'd together).

CREATE POLICY "View team profiles" ON public.profiles
FOR SELECT
USING (
    id IN (
        SELECT user_id FROM public.professionals 
        WHERE organization_id IN (
            SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
        )
    )
);

-- B. Invitations: Setup RLS
ALTER TABLE IF EXISTS public.invitations ENABLE ROW LEVEL SECURITY;

-- 1. View invitations for my organization
/*
CREATE POLICY "View organization invitations" ON public.invitations
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
    )
);
*/

-- 2. Admin can manage invitations (Insert, Update, Delete)
-- 2. Admin can manage invitations (Insert, Update, Delete)
/*
CREATE POLICY "Admin manage invitations" ON public.invitations
FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM public.professionals 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);
*/
