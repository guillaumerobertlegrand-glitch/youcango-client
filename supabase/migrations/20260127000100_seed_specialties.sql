-- Migration: Seed Config Specialties
-- Description: Inserts the 12 priority specialties.

-- Clear existing Restaurant specialties (optional, but ensures clean slate for standard list)
-- DELETE FROM public.config_specialties WHERE industry_prefix = '56';

INSERT INTO public.config_specialties 
(slug, label_full, label_map, icon_name, display_order, category, industry_prefix)
VALUES
('burger-fastfood', 'Restauration Rapide & Burger', 'Burger / Rapide', 'takeoutbag.and.cup.and.card', 1, 'restaurant', '56'),
('pizzeria-italien', 'Pizzeria & Italien', 'Pizza / Italien', 'fork.knife', 2, 'restaurant', '56'),
('brasserie-traditionnelle', 'Cuisine Traditionnelle & Brasserie', 'Brasserie', 'wineglass', 3, 'restaurant', '56'),
('japonais', 'Japonais (Sushi, Ramen)', 'Japonais', 'leaf', 4, 'restaurant', '56'),
('asiatique', 'Asiatique (Chinois, Thaï...)', 'Asiatique', 'bowl.fill', 5, 'restaurant', '56'),
('kebab-streetfood', 'Kebab & Street Food', 'Kebab / Street', 'flame', 6, 'restaurant', '56'),
('boulangerie-snacking', 'Boulangerie & Snacking', 'Boulangerie', 'cup.and.saucer', 7, 'restaurant', '56'),
('grill-steakhouse', 'Grill & Viandes (Steakhouse)', 'Grill / Viande', 'flame.fill', 8, 'restaurant', '56'),
('cuisine-monde', 'Cuisine du Monde (Indien, Mexicain...)', 'Cuisine Monde', 'globe', 9, 'restaurant', '56'),
('healthy-vege', 'Healthy, Saladerie & Végétarien', 'Healthy / Végé', 'leaf.fill', 10, 'restaurant', '56'),
('gastronomique', 'Gastronomique & Bistronomique', 'Gastronomie', 'laurel.leading', 11, 'restaurant', '56'),
('autre', 'Autre / Concept unique', 'Autre', 'ellipsis.circle', 12, 'restaurant', '56')
ON CONFLICT (slug) DO UPDATE SET
    label_full = EXCLUDED.label_full,
    label_map = EXCLUDED.label_map,
    icon_name = EXCLUDED.icon_name,
    display_order = EXCLUDED.display_order,
    category = EXCLUDED.category,
    industry_prefix = EXCLUDED.industry_prefix;
