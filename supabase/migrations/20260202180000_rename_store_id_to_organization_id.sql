-- Rename store_id to organization_id in profiles table
-- This unifies the source of truth for organization linkage.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'store_id'
    ) THEN
        ALTER TABLE public.profiles RENAME COLUMN store_id TO organization_id;
    END IF;
END $$;
