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
CREATE POLICY "Public can view active services" ON public.services FOR SELECT USING (active = true);
CREATE POLICY "Public can view active professionals" ON public.professionals FOR SELECT USING (status = 'active');
CREATE POLICY "Public can view free slots" ON public.slots FOR SELECT USING (status = 'free');

-- 2. Managers have full control over their Organization's data
-- (Assuming we have a way to link auth.uid() -> professional.id -> role='manager')
-- For MVP/Demo: Allow authenticated users to act as managers for now, or refine later.
CREATE POLICY "Authenticated users can manage services" ON public.services FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage pros" ON public.professionals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage authorizations" ON public.professional_service_authorizations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage slots" ON public.slots FOR ALL USING (auth.role() = 'authenticated');
-- Seed Data for Pro Architecture Demo

DO $$
DECLARE
    v_org_id UUID;
    v_manager_id UUID;
    v_staff_id UUID;
    v_service_cut UUID;
    v_service_beard UUID;
    v_service_shave UUID;
BEGIN
    -- 1. Create Organization & Location
    INSERT INTO public.organizations (name, business_type, category, status, wifi_ssid)
    VALUES ('The Dandy Barber', 'service', 'barber', 'active', 'DandyGuest_Free')
    RETURNING id INTO v_org_id;

    INSERT INTO public.locations (organization_id, name, address, coordinates)
    VALUES (v_org_id, 'Main Shop', '12 Rue de la Paix, Paris', ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography);

    -- 2. Create Professionals
    INSERT INTO public.professionals (organization_id, first_name, last_name, role, status)
    VALUES (v_org_id, 'Jean', 'Dujardin', 'manager', 'active')
    RETURNING id INTO v_manager_id;

    INSERT INTO public.professionals (organization_id, first_name, last_name, role, status)
    VALUES (v_org_id, 'Paul', 'Pogba', 'staff', 'active')
    RETURNING id INTO v_staff_id;

    -- 3. Create Services
    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES 
    (v_org_id, 'Classic Haircut', 'Scissors only, traditional style.', 30, 45, 35.00, '€€', true) RETURNING id INTO v_service_cut;

    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES 
    (v_org_id, 'Beard Trim', 'Clipper work and lineup.', 15, 20, 20.00, '€', true) RETURNING id INTO v_service_beard;

    INSERT INTO public.services (organization_id, title, description, duration_min, duration_max, price_amount, price_tier, slot_compatible)
    VALUES 
    (v_org_id, 'Royal Shave', 'Hot towel, straight razor.', 45, 60, 50.00, '€€€', true) RETURNING id INTO v_service_shave;

    -- 4. Authorizations (Habilitations)
    -- Jean (Manager) can do everything
    INSERT INTO public.professional_service_authorizations (professional_id, service_id, authorized, skill_level) VALUES
    (v_manager_id, v_service_cut, true, 'expert'),
    (v_manager_id, v_service_beard, true, 'expert'),
    (v_manager_id, v_service_shave, true, 'expert');

    -- Paul (Staff) can only do Cut and Beard
    INSERT INTO public.professional_service_authorizations (professional_id, service_id, authorized, skill_level) VALUES
    (v_staff_id, v_service_cut, true, 'standard'),
    (v_staff_id, v_service_beard, true, 'advanced');
    -- Paul is NOT authorized for Royal Shave

    -- 5. Create Slots (Availability for Today)
    -- Jean has some slots
    INSERT INTO public.slots (organization_id, service_id, professional_id, start_time, end_time, status) VALUES
    (v_org_id, v_service_cut, v_manager_id, now() + interval '1 hour', now() + interval '1 hour 30 minutes', 'free'),
    (v_org_id, v_service_shave, v_manager_id, now() + interval '2 hours', now() + interval '2 hours 45 minutes', 'free');

    -- Paul has slots
    INSERT INTO public.slots (organization_id, service_id, professional_id, start_time, end_time, status) VALUES
    (v_org_id, v_service_cut, v_staff_id, now() + interval '30 minutes', now() + interval '1 hour', 'free'),
    (v_org_id, v_service_beard, v_staff_id, now() + interval '1 hour', now() + interval '1 hour 15 minutes', 'free');

END $$;
-- Add availability_status to professionals table
-- distinct from 'status' (active/inactive) which is administrative.
-- 'available': Ready to receive requests
-- 'busy': Currently in a job (from P2 acceptance) or geographically away (system set)

ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available' 
CHECK (availability_status IN ('available', 'busy'));

-- Index for fast lookup of available pros
CREATE INDEX IF NOT EXISTS idx_pros_availability ON public.professionals(availability_status);
-- Add slot_id to sessions to link a booking to a specific time/pro
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES public.slots(id);

-- Update the RPC to accept slot_id PRESERVING existing params
CREATE OR REPLACE FUNCTION api_v1_create_session(
    p_location_id UUID,
    p_monetization_model TEXT,
    p_arrival_timing_minutes INTEGER DEFAULT NULL,
    p_slot_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_session_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.sessions (
        customer_id,
        location_id,
        monetization_model,
        arrival_timing,
        slot_id,
        state
    ) VALUES (
        v_user_id,
        p_location_id,
        p_monetization_model,
        CASE WHEN p_arrival_timing_minutes IS NOT NULL THEN (p_arrival_timing_minutes || ' minutes')::interval ELSE NULL END,
        p_slot_id,
        'locking'
    )
    RETURNING id INTO v_session_id;

    -- If slot is provided, ideally mark it as held/reserved here
    -- For MVP/Demo we skip strict inventory locking logic

    SELECT jsonb_build_object(
        'session_id', v_session_id,
        'status', 'created'
    ) INTO v_result;

    RETURN v_result;
END;
$$;
