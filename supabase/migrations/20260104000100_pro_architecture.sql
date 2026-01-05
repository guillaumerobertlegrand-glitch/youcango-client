-- Enhance Organizations table with status and policies
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS ycg_policies JSONB DEFAULT '{}'::jsonb, -- No-show rules, delay tolerance
ADD COLUMN IF NOT EXISTS wifi_ssid TEXT,
ADD COLUMN IF NOT EXISTS ble_uuid UUID;

-- Professionals table (Staff & Managers)
CREATE TABLE IF NOT EXISTS public.professionals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to Auth User (optional for dummy pros)
    first_name TEXT NOT NULL,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'admin', 'staff')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    default_capacity INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Services Generic Definition (Owned by Organization)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration_min INTEGER NOT NULL,
    duration_max INTEGER NOT NULL,
    price_amount DECIMAL(10, 2),
    price_currency TEXT DEFAULT 'EUR',
    price_tier TEXT CHECK (price_tier IN ('€', '€€', '€€€', '€€€€')),
    slot_compatible BOOLEAN DEFAULT true,
    complexity_level TEXT CHECK (complexity_level IN ('low', 'medium', 'high')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Professional Habilitations (Who can do what)
CREATE TABLE IF NOT EXISTS public.professional_service_authorizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
    authorized BOOLEAN DEFAULT true,
    skill_level TEXT DEFAULT 'standard',
    priority INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id), -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(professional_id, service_id)
);

-- Slots (The inventory)
CREATE TABLE IF NOT EXISTS public.slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE, -- Nullable for pooled slots
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'held', 'reserved', 'expired', 'cancelled')),
    hold_until TIMESTAMP WITH TIME ZONE,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pros_org ON public.professionals(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_org ON public.services(organization_id);
CREATE INDEX IF NOT EXISTS idx_slots_time ON public.slots(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_slots_status ON public.slots(status);

-- RLS Policies
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_service_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Access for Active Offers (Simplified for MVP)
-- 1. Public Read Access for Active Offers (Simplified for MVP)
DROP POLICY IF EXISTS "Public can view active services" ON public.services;
CREATE POLICY "Public can view active services" ON public.services FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Public can view active professionals" ON public.professionals;
CREATE POLICY "Public can view active professionals" ON public.professionals FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Public can view free slots" ON public.slots;
CREATE POLICY "Public can view free slots" ON public.slots FOR SELECT USING (status = 'free');

-- 2. Managers have full control over their Organization's data
DROP POLICY IF EXISTS "Authenticated users can manage services" ON public.services;
CREATE POLICY "Authenticated users can manage services" ON public.services FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage pros" ON public.professionals;
CREATE POLICY "Authenticated users can manage pros" ON public.professionals FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage authorizations" ON public.professional_service_authorizations;
CREATE POLICY "Authenticated users can manage authorizations" ON public.professional_service_authorizations FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage slots" ON public.slots;
CREATE POLICY "Authenticated users can manage slots" ON public.slots FOR ALL USING (auth.role() = 'authenticated');
