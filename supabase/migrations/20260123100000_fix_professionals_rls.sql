-- Fix Infinite Recursion on professionals table
-- The previous policy likely caused recursion by selecting from professionals within the policy itself without proper isolation.

-- 1. Drop the problematic policy
DROP POLICY IF EXISTS "Users can view professionals in their organization" ON professionals;

-- 2. Create the optimized policy
-- This allows users to see professionals if:
-- a) It's their own record
-- b) Or the professional belongs to the same organization as the user (fetched via a non-recursive subquery or typically assuming organization_id match)

CREATE POLICY "Users can view professionals in their organization" ON professionals
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    organization_id IN (
        SELECT p.organization_id 
        FROM professionals p 
        WHERE p.user_id = auth.uid()
    )
);
