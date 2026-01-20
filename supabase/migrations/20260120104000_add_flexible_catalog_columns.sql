-- Add Flexible Catalog columns to Organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS response_timeout INT DEFAULT 60,
ADD COLUMN IF NOT EXISTS price_range INT CHECK (price_range BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS avg_duration INT; -- In minutes

COMMENT ON COLUMN public.organizations.response_timeout IS 'Time in seconds to accept an instant request';
COMMENT ON COLUMN public.organizations.price_range IS 'Price range index (1-5) for Restaurants/Merchants';
COMMENT ON COLUMN public.organizations.avg_duration IS 'Average duration of service in minutes (for Restaurants)';
