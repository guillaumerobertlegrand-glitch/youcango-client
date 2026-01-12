-- Update Professionals Roles
-- Switch from 'manager', 'admin', 'staff' -> 'admin', 'editor', 'user'

-- 1. Drop old constraint
ALTER TABLE public.professionals DROP CONSTRAINT IF EXISTS professionals_role_check;

-- 2. Migrate Data
-- manager -> editor
-- staff -> user
-- admin -> admin (no change)

UPDATE public.professionals SET role = 'editor' WHERE role = 'manager';
UPDATE public.professionals SET role = 'user' WHERE role = 'staff';

-- 3. Add new constraint
ALTER TABLE public.professionals 
ADD CONSTRAINT professionals_role_check 
CHECK (role IN ('admin', 'editor', 'user'));

-- 4. Set Default
ALTER TABLE public.professionals ALTER COLUMN role SET DEFAULT 'user';
