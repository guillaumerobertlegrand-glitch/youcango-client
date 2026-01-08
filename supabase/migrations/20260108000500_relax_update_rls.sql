-- Relax RLS for Demo Purposes to allow Client Simulation to update ETA
-- Since the Client might be anonymous or using a generated ID not strictly bound to auth.uid() in the initial RLS context.

-- 1. Allow Anonymous/Public Updates to Sessions (Risky for Prod, OK for Demo)
DROP POLICY IF EXISTS "Allow anon update sessions" ON public.sessions;
CREATE POLICY "Allow anon update sessions" ON public.sessions
FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- 2. Ensure Authenticated users can also update (if not covered by existing policy)
DROP POLICY IF EXISTS "Allow authenticated update sessions" ON public.sessions;
CREATE POLICY "Allow authenticated update sessions" ON public.sessions
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. Explicitly Grant UPDATE permission on the table to anon role (sometimes needed)
GRANT UPDATE ON TABLE public.sessions TO anon;
GRANT UPDATE ON TABLE public.sessions TO authenticated;
