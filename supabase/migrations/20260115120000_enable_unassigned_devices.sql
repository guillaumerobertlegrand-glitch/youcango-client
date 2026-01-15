-- Enable Unassigned Devices (Device Pool)
-- Original schema required every device to be owned by a Pro (pro_id NOT NULL).
-- We now support Org-owned devices that are unassigned.

-- 1. Make pro_id nullable
ALTER TABLE public.devices ALTER COLUMN pro_id DROP NOT NULL;

-- 2. Drop the old index if it exists (optional but good hygiene if name is standard)
-- DROP INDEX IF EXISTS idx_devices_pro_id;
-- Recreate or keep simple index on pro_id (indexes handle nulls fine)

-- 3. Ensure organization_id is indexed (already done in previous migration)
