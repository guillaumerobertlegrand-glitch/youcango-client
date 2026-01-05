-- Cleanup Legacy Table 'stores'
-- This table is no longer used in the V1 architecture (replaced by 'organizations').
-- We use CASCADE to automatically drop references (Foreign Keys) from other tables.

DROP TABLE IF EXISTS public.stores CASCADE;

-- If there are other legacy tables typically associated, we can drop them here too
-- e.g. DROP TABLE IF EXISTS public.products CASCADE; -- If you had products linked to stores

-- Ensure 'organizations' is definitely the source of truth
COMMENT ON TABLE public.organizations IS 'Primary entity for YouCanGo Pro V1';
