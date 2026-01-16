-- Config Engine Schema & Seed
-- Implements Industries and Specialties lookup tables.

-- 1. Industries (APE Groupings)
CREATE TABLE IF NOT EXISTS public.config_industries (
    ape_prefix TEXT PRIMARY KEY, -- e.g. '56', '9602A'
    label TEXT NOT NULL,
    billing_model TEXT DEFAULT 'commission', -- 'commission' or 'subscription'
    commission_rate NUMERIC(4,2) DEFAULT 0.10, -- 10%
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Specialties (Sub-categories with Templates)
CREATE TABLE IF NOT EXISTS public.config_specialties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    industry_prefix TEXT REFERENCES public.config_industries(ape_prefix) ON DELETE CASCADE,
    label TEXT NOT NULL,
    catalog_template JSONB DEFAULT '[]'::jsonb, -- Array of { title, duration, price }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Update Organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS specialty_id UUID REFERENCES public.config_specialties(id);

-- 4. RLS (Public Read, Admin Write)
ALTER TABLE public.config_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Industries" ON public.config_industries FOR SELECT USING (true);
CREATE POLICY "Public Read Specialties" ON public.config_specialties FOR SELECT USING (true);

-- 5. SEED DATA

-- Industries
INSERT INTO public.config_industries (ape_prefix, label, commission_rate) VALUES
('56', 'Restauration', 0.10),
('4520', 'Entretien Véhicules', 0.08),
('9602A', 'Coiffure', 0.12),
('9602B', 'Soins de Beauté', 0.12)
ON CONFLICT (ape_prefix) DO UPDATE SET label = EXCLUDED.label;

-- Specialties (with MVP Templates)
-- Restauration (56)
INSERT INTO public.config_specialties (industry_prefix, label, catalog_template) VALUES
('56', 'Italien', '[
    {"title": "Pizza Margherita", "duration": "15 minutes", "price": 12},
    {"title": "Pasta Carbonara", "duration": "15 minutes", "price": 14},
    {"title": "Tiramisu", "duration": "5 minutes", "price": 8}
]'),
('56', 'Japonais', '[
    {"title": "Plateau Sushi Mix (12pc)", "duration": "20 minutes", "price": 18},
    {"title": "Soupe Miso", "duration": "5 minutes", "price": 4},
    {"title": "Brochettes Boeuf-Fromage", "duration": "15 minutes", "price": 6}
]'),
('56', 'Brasserie', '[
    {"title": "Steak Frites", "duration": "20 minutes", "price": 16},
    {"title": "Croque Monsieur", "duration": "15 minutes", "price": 10},
    {"title": "Café Gourmand", "duration": "10 minutes", "price": 8}
]'),
('56', 'Autre / Général', '[
    {"title": "Plat du Jour", "duration": "20 minutes", "price": 14},
    {"title": "Formule Midi", "duration": "0 minutes", "price": 18}
]');

-- Auto (4520)
INSERT INTO public.config_specialties (industry_prefix, label, catalog_template) VALUES
('4520', 'Mécanique Générale', '[
    {"title": "Vidange + Filtre", "duration": "45 minutes", "price": 89},
    {"title": "Diagnostic Électronique", "duration": "30 minutes", "price": 49}
]'),
('4520', 'Électrique', '[
    {"title": "Diagnostic Batterie", "duration": "20 minutes", "price": 30},
    {"title": "Recharge Clim", "duration": "60 minutes", "price": 79}
]'),
('4520', 'Carrosserie', '[
    {"title": "Débosselage sans peinture", "duration": "60 minutes", "price": 120},
    {"title": "Raccord Peinture", "duration": "120 minutes", "price": 250}
]'),
('4520', 'Autre / Général', '[
    {"title": "Révision Complète", "duration": "90 minutes", "price": 150},
    {"title": "Changement Pneus (x2)", "duration": "45 minutes", "price": 40}
]');

-- Coiffure (9602A)
INSERT INTO public.config_specialties (industry_prefix, label, catalog_template) VALUES
('9602A', 'Salon Mixte', '[
    {"title": "Coupe Femme (Shamp + Coupe + Brush)", "duration": "60 minutes", "price": 45},
    {"title": "Coupe Homme", "duration": "30 minutes", "price": 25},
    {"title": "Coupe Enfant", "duration": "20 minutes", "price": 18}
]'),
('9602A', 'Barber', '[
    {"title": "Taille Barbe (Tondeuse)", "duration": "20 minutes", "price": 20},
    {"title": "Rasage à l''ancienne", "duration": "30 minutes", "price": 35},
    {"title": "Forfait Coupe + Barbe", "duration": "50 minutes", "price": 50}
]'),
('9602A', 'Coloriste', '[
    {"title": "Coloration Racines", "duration": "90 minutes", "price": 60},
    {"title": "Balayage", "duration": "120 minutes", "price": 110},
    {"title": "Patine", "duration": "30 minutes", "price": 30}
]'),
('9602A', 'Autre / Général', '[
    {"title": "Coupe Standard", "duration": "30 minutes", "price": 28},
    {"title": "Shampoing Brushing", "duration": "30 minutes", "price": 22}
]');

-- Beauté (9602B)
INSERT INTO public.config_specialties (industry_prefix, label, catalog_template) VALUES
('9602B', 'Onglerie', '[
    {"title": "Pose Vernis Semi-Permanent", "duration": "45 minutes", "price": 35},
    {"title": "Manucure Complète", "duration": "30 minutes", "price": 25},
    {"title": "Dépose", "duration": "20 minutes", "price": 15}
]'),
('9602B', 'Soins Visage', '[
    {"title": "Soin Hydratant", "duration": "60 minutes", "price": 65},
    {"title": "Massage Visage Kobeido", "duration": "45 minutes", "price": 80}
]'),
('9602B', 'Épilation', '[
    {"title": "Jambes Complètes", "duration": "30 minutes", "price": 28},
    {"title": "Maillot Intégral", "duration": "20 minutes", "price": 25},
    {"title": "Sourcils", "duration": "10 minutes", "price": 12}
]'),
('9602B', 'Autre / Général', '[
    {"title": "Soin Découverte", "duration": "30 minutes", "price": 45},
    {"title": "Massage Relaxant (30min)", "duration": "30 minutes", "price": 40}
]');
