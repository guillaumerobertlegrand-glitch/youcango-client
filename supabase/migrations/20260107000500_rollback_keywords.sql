-- ROLLBACK KEYWORDS (CLEANUP)
-- Restoring categories to their clean state to avoid UI clutter.

-- 1. Reset Dandy Barber to its previous specific state (from fix_search_keywords.sql)
UPDATE public.organizations
SET category = 'barber, coiffeur, haircut, beauty, service'
WHERE name LIKE 'The Dandy Barber%';

-- 2. Reset Beauty Salons to simple category
UPDATE public.organizations
SET category = 'beauty_salon'
WHERE name LIKE 'Éclat du Marais%';

-- 3. Reset others if affected (Safety net)
UPDATE public.organizations
SET category = 'barber'
WHERE category ILIKE '%barber%' AND name NOT LIKE 'The Dandy Barber%';
