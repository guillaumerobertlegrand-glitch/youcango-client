-- Relax policies on organizations and services for Demo/MVP
-- This allows Anonymous users (which might be simulating Pros) to View and Edit Data.

-- 1. Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.organizations;
CREATE POLICY "Enable read access for all users" ON public.organizations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.organizations;
CREATE POLICY "Enable update access for all users" ON public.organizations FOR UPDATE USING (true);


-- 2. Services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.services;
CREATE POLICY "Enable read access for all users" ON public.services FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.services;
CREATE POLICY "Enable insert access for all users" ON public.services FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.services;
CREATE POLICY "Enable update access for all users" ON public.services FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.services;
CREATE POLICY "Enable delete access for all users" ON public.services FOR DELETE USING (true);
