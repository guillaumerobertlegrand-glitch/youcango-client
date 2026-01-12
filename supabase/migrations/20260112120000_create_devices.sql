-- Create Devices Table
-- Linked to professionals. Used for specific hardware triggers.

CREATE TYPE public.device_type AS ENUM ('phone', 'watch', 'glasses', 'tablet', 'pc');

CREATE TABLE IF NOT EXISTS public.devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pro_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
    type public.device_type NOT NULL,
    name TEXT, -- e.g. "Mike's Watch"
    trigger_config JSONB DEFAULT '{}'::jsonb, -- Specific logic per device
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for performance
CREATE INDEX idx_devices_pro_id ON public.devices(pro_id);

-- RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Policy: Pros can see their own devices (assuming auth link in professionals table)
-- Managers/Admins can manage devices.
-- For MVP/Demo: Authenticated users can manage all (Simplified)
CREATE POLICY "Authenticated users can manage devices" ON public.devices FOR ALL USING (auth.role() = 'authenticated');
