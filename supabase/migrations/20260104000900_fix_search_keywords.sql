-- Make "The Dandy Barber" findable by French keywords
-- The search RPC uses ILIKE on name and category.
-- We update these fields to cover 'coiffeur', 'barbier', 'haircut'.

UPDATE public.organizations
SET 
  name = 'The Dandy Barber - Coiffeur / Barbier',
  category = 'barber, coiffeur, haircut, beauty, service'
WHERE 
  name LIKE 'The Dandy Barber%';

-- Verify if others need update, but Dandy is the key for demo.
