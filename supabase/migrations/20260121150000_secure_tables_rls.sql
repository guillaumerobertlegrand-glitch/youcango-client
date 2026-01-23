-- Enable RLS on all relevant tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_service_authorizations ENABLE ROW LEVEL SECURITY;

-- Config Tables (Read Only for Authenticated, Full Access for Service Role)
-- config_industries
ALTER TABLE public.config_industries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.config_industries;
CREATE POLICY "Enable read access for authenticated users" ON public.config_industries FOR SELECT TO authenticated USING (true);

-- config_specialties
ALTER TABLE public.config_specialties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.config_specialties;
CREATE POLICY "Enable read access for authenticated users" ON public.config_specialties FOR SELECT TO authenticated USING (true);

-- config_device_types
ALTER TABLE public.config_device_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.config_device_types;
CREATE POLICY "Enable read access for authenticated users" ON public.config_device_types FOR SELECT TO authenticated USING (true);

-- services (Catalog - Read Only for Authenticated)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.services;
CREATE POLICY "Enable read access for authenticated users" ON public.services FOR SELECT TO authenticated USING (true);

-- SYSTEM CONFIG
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.system_config;
CREATE POLICY "Enable read access for authenticated users" ON public.system_config FOR SELECT TO authenticated USING (true);

-- PROFILES (Users)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ORGANIZATION SECRETS (Sensitive - Service Role Only)
ALTER TABLE public.organization_secrets ENABLE ROW LEVEL SECURITY;
-- No policies created implies DENY ALL for implicit roles (authenticated/anon).
-- Only Service Role (RPC/Edge Functions) bypasses RLS.

-- DEVICES
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
-- View: Members of the organization (assuming organization_id link)
DROP POLICY IF EXISTS "View organization devices" ON public.devices;
CREATE POLICY "View organization devices" ON public.devices
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
);
-- Manage: Admins
DROP POLICY IF EXISTS "Manage organization devices" ON public.devices;
CREATE POLICY "Manage organization devices" ON public.devices
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- SLOTS
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View organization slots" ON public.slots;
CREATE POLICY "View organization slots" ON public.slots
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
);

-- COOLDOWNS
ALTER TABLE public.cooldowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read cooldowns" ON public.cooldowns;
CREATE POLICY "Read cooldowns" ON public.cooldowns FOR SELECT TO authenticated USING (true);

-- ORGANIZATIONS
-- 1. View: Members can view their own organization
DROP POLICY IF EXISTS "Members can view their own organization" ON public.organizations;
CREATE POLICY "Members can view their own organization" ON public.organizations
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
);

-- 2. Update: Admins/Editors can update their own organization
-- Note: 'user' role might effectively mean read-only, but let's allow all members to update for now to avoid complexity, 
-- or restrict if needed. The prompt implies "L'utilisateur doit uniquement pouvoir lire/modifier l'organisation à laquelle il est lié".
DROP POLICY IF EXISTS "Members can update their own organization" ON public.organizations;
CREATE POLICY "Members can update their own organization" ON public.organizations
FOR UPDATE TO authenticated
USING (
  id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
);

-- 3. Insert: Allow creation ONLY if user is not already linked to an organization
-- "un utilisateur auth.uid() ne peut être lié qu'à une seule organisation active"
DROP POLICY IF EXISTS "Authenticated users can create an organization" ON public.organizations;
CREATE POLICY "Authenticated users can create an organization" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.professionals 
    WHERE user_id = auth.uid() 
    AND organization_id IS NOT NULL
  )
);

-- PROFESSIONALS
-- 1. View: Self and Colleagues
DROP POLICY IF EXISTS "View self and colleagues" ON public.professionals;
CREATE POLICY "View self and colleagues" ON public.professionals
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() 
  OR 
  organization_id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
);

-- 2. Update: Self Only
DROP POLICY IF EXISTS "Update self" ON public.professionals;
CREATE POLICY "Update self" ON public.professionals
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Insert: Service Role ONLY (Managed via Triggers/RPC usually)
-- IF the Onboarding Step 4 invites users via client-side insert, this would block it.
-- But usually invitations are done via RPC/Edge Function. Step 1 creation is RPC.
-- We will implicitely DENY Insert for 'authenticated' by not adding a policy. Service Role bypasses RLS.

-- PROFESSIONAL SERVICE AUTHORIZATIONS (Skills Matrix)
-- Linked via professional_id. No organization_id column.
-- View: Members can see authorizations for professionals in their organization.
DROP POLICY IF EXISTS "View team authorizations" ON public.professional_service_authorizations;
CREATE POLICY "View team authorizations" ON public.professional_service_authorizations
FOR SELECT TO authenticated
USING (
  professional_id IN (
    SELECT id FROM public.professionals 
    WHERE organization_id IN (
      SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
    )
  )
);

-- Manage (Insert/Update/Delete): Admin Only checking relation via professional_id
DROP POLICY IF EXISTS "Admins can manage authorizations" ON public.professional_service_authorizations;
CREATE POLICY "Admins can manage authorizations" ON public.professional_service_authorizations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.professionals me
    JOIN public.professionals target ON target.id = professional_service_authorizations.professional_id
    WHERE me.user_id = auth.uid() 
    AND me.role = 'admin'
    AND me.organization_id = target.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.professionals me
    JOIN public.professionals target ON target.id = professional_service_authorizations.professional_id
    WHERE me.user_id = auth.uid() 
    AND me.role = 'admin'
    AND me.organization_id = target.organization_id
  )
);

-- SESSIONS
-- Linked via location_id -> organizations
-- View/Update: Members of the org (Pros) OR The Customer
DROP POLICY IF EXISTS "View organization sessions" ON public.sessions;
CREATE POLICY "View organization sessions" ON public.sessions
FOR SELECT TO authenticated
USING (
  location_id IN (
    SELECT l.id FROM public.locations l
    WHERE l.organization_id IN (
        SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
    )
  )
  OR
  customer_id = auth.uid()
);

DROP POLICY IF EXISTS "Manage organization sessions" ON public.sessions;
CREATE POLICY "Manage organization sessions" ON public.sessions
FOR ALL TO authenticated
USING (
  location_id IN (
    SELECT l.id FROM public.locations l
    WHERE l.organization_id IN (
        SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
    )
  )
  OR
  customer_id = auth.uid()
)
WITH CHECK (
  location_id IN (
    SELECT l.id FROM public.locations l
    WHERE l.organization_id IN (
        SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
    )
  )
  OR
  customer_id = auth.uid()
);

-- LOCATIONS (Linked to Organization)
DROP POLICY IF EXISTS "View organization locations" ON public.locations;
CREATE POLICY "View organization locations" ON public.locations
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
);

-- Allow admins/editors to manage locations? Assuming yes for now.
DROP POLICY IF EXISTS "Manage organization locations" ON public.locations;
CREATE POLICY "Manage organization locations" ON public.locations
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
  )
);
