-- Create APE Mappings Table
CREATE TABLE IF NOT EXISTS public.ape_mappings (
    ape_code TEXT PRIMARY KEY, -- Format: 10.71C (with dots)
    business_type TEXT NOT NULL, -- 'merchant', 'restaurant', 'service'
    category TEXT NOT NULL, -- 'bakery', 'florist', 'food_service', etc.
    label TEXT -- Human readable label
);

-- RLS
ALTER TABLE public.ape_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.ape_mappings
FOR SELECT USING (auth.role() = 'authenticated');

-- Seed Data (Bakeries, Restaurants, Retail)
INSERT INTO public.ape_mappings (ape_code, business_type, category, label) VALUES
-- Bakeries
('10.71C', 'merchant', 'bakery', 'Boulangerie et boulangerie-pâtisserie'),
('10.71B', 'merchant', 'bakery', 'Cuisson de produits de boulangerie'),
('10.71D', 'merchant', 'bakery', 'Pâtisserie'),
-- Restaurants
('56.10A', 'restaurant', 'food_service', 'Restauration traditionnelle'),
('56.10C', 'restaurant', 'food_service', 'Restauration de type rapide'),
('56.30Z', 'restaurant', 'bar', 'Débits de boissons'),
-- Florists
('47.76Z', 'merchant', 'florist', 'Commerce de détail de fleurs'),
-- Hair / Beauty
('96.02A', 'service', 'hair_salon', 'Coiffure'),
('96.02B', 'service', 'beauty_salon', 'Soins de beauté')
ON CONFLICT (ape_code) DO NOTHING;

-- Function to check APE (Optional helper, but mostly client-side lookup)
