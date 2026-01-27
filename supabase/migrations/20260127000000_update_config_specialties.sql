-- Migration: Update config_specialties schema for iOS Pro Standards
-- Description: Adds slug, label_map, icon_name, category, is_active, display_order. Renames label to label_full.

-- 1. Rename existing label to label_full (if not already done, or handled via logic)
-- We will rename it to preserve data, but we might need to backfill new columns later.
ALTER TABLE public.config_specialties 
RENAME COLUMN label TO label_full;

-- 2. Add new columns
ALTER TABLE public.config_specialties
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS label_map TEXT,
ADD COLUMN IF NOT EXISTS icon_name TEXT,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'restaurant',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- 3. Add Indexes
CREATE INDEX IF NOT EXISTS idx_config_specialties_slug ON public.config_specialties(slug);
CREATE INDEX IF NOT EXISTS idx_config_specialties_category ON public.config_specialties(category);

-- 4. Backfill/Default for existing rows to avoid NULLs (Optional but good practice)
-- Logic: If slug is null, we can momentarily leave it since we'll receive a data dump. 
-- But keeping constraints flexible for now.

-- 5. Force Refresh of Schema Cache (if needed by RPCs)
NOTIFY pgrst, 'reload config';
