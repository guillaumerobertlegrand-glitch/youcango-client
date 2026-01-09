-- Enrich Rennes Organizations with Phones and Images

-- 1. Le Galopin (Classic Bistro)
UPDATE public.organizations
SET 
  phone = '02 99 79 00 01',
  image_url = 'https://images.unsplash.com/photo-1550966871-3ed3c47e2ce2?q=80&w=800&auto=format&fit=crop' -- Bistro vibe
WHERE name = 'Le Galopin';

-- 2. L''Ambassade (Chic)
UPDATE public.organizations
SET 
  phone = '02 99 79 00 02',
  image_url = 'https://images.unsplash.com/photo-1514362545857-3bc16549766b?q=80&w=800&auto=format&fit=crop' -- Fancy cocktail/dining vibe
WHERE name = 'L''Ambassade';

-- 3. Crêperie Sainte-Anne (Authentic)
UPDATE public.organizations
SET 
  phone = '02 99 79 00 03',
  image_url = 'https://images.unsplash.com/photo-1528699633788-424224dc89b5?q=80&w=800&auto=format&fit=crop' -- Crepes/Food vibe
WHERE name = 'Crêperie Sainte-Anne';
