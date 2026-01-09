-- Enrich Remaining Organizations (Paris & Rennes Florists) with Phones and Images

-- ------------------------------
-- PARIS
-- ------------------------------

-- 1. Bistro de la Bastille
UPDATE public.organizations
SET 
  phone = '01 43 43 00 01',
  image_url = 'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=800&auto=format&fit=crop' -- Bistro Parisien
WHERE name = 'Bistro de la Bastille';

-- 2. L''Oiseau de Seine
UPDATE public.organizations
SET 
  phone = '01 43 00 00 02',
  image_url = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop' -- Seine View / Gastronomy
WHERE name = 'L''Oiseau de Seine';

-- 3. Le Grand Burger Halles
UPDATE public.organizations
SET 
  phone = '01 42 00 00 03',
  image_url = 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=800&auto=format&fit=crop' -- Burger Joint
WHERE name = 'Le Grand Burger Halles';

-- 4. La fournée des Écoles (Bakery)
UPDATE public.organizations
SET 
  phone = '01 46 00 00 04',
  image_url = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=800&auto=format&fit=crop' -- Bakery
WHERE name = 'La fournée des Écoles';

-- 5. Éclat du Marais (Beauty)
UPDATE public.organizations
SET 
  phone = '01 48 00 00 05',
   image_url = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop' -- Beauty Salon
WHERE name = 'Éclat du Marais';

-- ------------------------------
-- RENNES (FLORISTS)
-- ------------------------------

-- 1. Fleurs de Rennes
UPDATE public.organizations
SET 
  phone = '02 99 00 10 01',
  image_url = 'https://images.unsplash.com/photo-1490750967868-58cb75069ed6?q=80&w=800&auto=format&fit=crop' -- Flower Shop
WHERE name = 'Fleurs de Rennes';

-- 2. Le Jardin de Lise
UPDATE public.organizations
SET 
  phone = '02 99 00 10 02',
  image_url = 'https://images.unsplash.com/photo-1563242158-80993069165d?q=80&w=800&auto=format&fit=crop' -- Green Plants / Garden
WHERE name = 'Le Jardin de Lise';

-- 3. Monceau Fleurs
UPDATE public.organizations
SET 
  phone = '02 99 00 10 03',
  image_url = 'https://images.unsplash.com/photo-1587316713735-e3d6411e7314?q=80&w=800&auto=format&fit=crop' -- Red Roses / Classic Florist
WHERE name = 'Monceau Fleurs';
