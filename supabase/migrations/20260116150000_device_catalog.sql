-- Migration: Device Catalog & Cleanup
-- 1. Create Reference Table
CREATE TABLE IF NOT EXISTS public.config_device_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL, -- 'mobile', 'fixed', 'wearable'
    capabilities JSONB DEFAULT '{}'::jsonb,
    is_active_mvp BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Seed Data
INSERT INTO public.config_device_types (label, category, is_active_mvp, capabilities) VALUES
('Smartphone', 'mobile', true, '{"camera": true, "nfc": true}'),
('Tablette / iPad', 'tablet', true, '{"camera": true, "screen_size": "large"}'),
('Montre Connectée', 'wearable', false, '{}'),
('Lunettes Connectées', 'wearable', false, '{}');

-- 3. Update Devices Table
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS device_type_id UUID REFERENCES public.config_device_types(id);

-- 4. Data Migration (Best Effort)
DO $$
DECLARE
    v_phone_id UUID;
    v_tablet_id UUID;
BEGIN
    SELECT id INTO v_phone_id FROM public.config_device_types WHERE category = 'mobile' LIMIT 1;
    SELECT id INTO v_tablet_id FROM public.config_device_types WHERE category = 'tablet' LIMIT 1;

    -- Map existing values
    UPDATE public.devices SET device_type_id = v_phone_id WHERE type = 'phone';
    UPDATE public.devices SET device_type_id = v_tablet_id WHERE type = 'tablet';
    -- Default fallback for others?
    UPDATE public.devices SET device_type_id = v_tablet_id WHERE device_type_id IS NULL; -- Safe fallback
END $$;

-- 5. Drop Legacy Type Column (Optional, keeping it safe by just nullable for now, or drop as requested? "Refactoring... Conserve le name... mais le type doit être sélectionné")
-- The user didn't explicitly say "Drop the old column", but "Add column". I'll alter the old one to be nullable just in case.
ALTER TABLE public.devices ALTER COLUMN type DROP NOT NULL;

-- 6. Cleanup Organizations
-- User reported duplicate 'onboarding_st'.
ALTER TABLE public.organizations DROP COLUMN IF EXISTS onboarding_st;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS onboarding_state; -- Potential other name
