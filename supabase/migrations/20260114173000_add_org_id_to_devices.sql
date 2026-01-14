-- Add organization_id to devices table to support Org-level queries
-- This fixes the 400 Bad Request on Step 4 Team page

ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill organization_id based on the pro owner
UPDATE public.devices d
SET organization_id = p.organization_id
FROM public.professionals p
WHERE d.pro_id = p.id
AND d.organization_id IS NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_devices_org_id ON public.devices(organization_id);

-- RLS: Add policy for Organization access
DO $$ BEGIN
    CREATE POLICY "Organizations can manage their devices" ON public.devices 
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM public.professionals WHERE organization_id = devices.organization_id
        )
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
