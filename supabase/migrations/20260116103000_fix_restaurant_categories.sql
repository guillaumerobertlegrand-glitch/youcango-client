-- Fix Categories for known test Restaurants to ensure they appear in serach.
-- We force them to be 'merchant' (business_type) and 'restaurant' (category).

UPDATE public.organizations
SET 
    business_type = 'merchant',
    category = 'restaurant'
WHERE 
    name ILIKE '%Restaurant%' 
    OR name ILIKE '%Cafe%' 
    OR name ILIKE '%Bistro%'
    OR name ILIKE '%Tomate%'
    OR name ILIKE '%Victoria%';
