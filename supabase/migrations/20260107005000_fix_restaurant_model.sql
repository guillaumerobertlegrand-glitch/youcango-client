-- ALIGN DATA MODEL: RESTAURANT = SERVICE
-- As per user discussion, Restaurants are bookings (Service), not product sales (Merchant).

-- 1. Update existing organizations
UPDATE public.organizations
SET business_type = 'service'
WHERE category = 'restaurant';

-- 2. Verify and Update specific demo data (Bastille, Cité, Halles) if they exist
-- (This ensures the 'merchant' constraint doesn't block them if we had one)

-- 3. Also fix Mechanics/Garages if they were considered 'merchant' but offer 'slots'
-- UPDATE public.organizations SET business_type = 'service' WHERE category = 'mechanic' OR category = 'garage';
-- (Optional, sticking to Restaurant for now as requested)
