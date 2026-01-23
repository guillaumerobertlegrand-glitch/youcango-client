-- Final Fix for Infinite Recursion on professionals table
-- We are removing ALL previous policies to ensure a clean slate.
-- We implement a strictly non-recursive policy: users can ONLY see their own row.

-- 1. Drop potentially conflicting policies
DROP POLICY IF EXISTS "Users can view professionals in their organization" ON professionals;
DROP POLICY IF EXISTS "fix_professionals_rls" ON professionals;
DROP POLICY IF EXISTS "Individual profile access" ON professionals;
DROP POLICY IF EXISTS "Enable read access for own organization professionals" ON professionals;

-- 2. Create the strict, non-recursive policy
CREATE POLICY "Self_access_only" ON professionals
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
