-- Refactor Services Table
-- Goal: Simplify to designation, estimated_duration, price.

-- 1. Rename title -> designation
ALTER TABLE public.services RENAME COLUMN title TO designation;

-- 2. Add new columns
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS estimated_duration INTERVAL,
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);

-- 3. Data Migration (Best Effort)
-- Map price_amount -> price
UPDATE public.services SET price = price_amount;

-- Map duration_min -> estimated_duration (approximate)
UPDATE public.services SET estimated_duration = (duration_min || ' minutes')::interval;

-- 4. Drop old columns
ALTER TABLE public.services
DROP COLUMN IF EXISTS duration_min,
DROP COLUMN IF EXISTS duration_max,
DROP COLUMN IF EXISTS price_amount,
DROP COLUMN IF EXISTS price_currency,
DROP COLUMN IF EXISTS price_tier,
DROP COLUMN IF EXISTS complexity_level;

-- 5. Add constraints/defaults if needed
ALTER TABLE public.services 
ALTER COLUMN designation SET NOT NULL;
