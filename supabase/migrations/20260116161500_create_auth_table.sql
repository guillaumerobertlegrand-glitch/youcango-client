-- Ensure Professional Service Authorizations Table Exists
CREATE TABLE IF NOT EXISTS public.professional_service_authorizations (
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    authorized BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    skill_level TEXT DEFAULT 'expert',
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (professional_id, service_id)
);

-- Enable RLS
ALTER TABLE public.professional_service_authorizations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view/edit their org's authorizations
CREATE POLICY "Users can view own org authorizations" ON public.professional_service_authorizations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.professionals p
            WHERE p.id = professional_service_authorizations.professional_id
            AND p.user_id = auth.uid()
        ) 
        OR 
        EXISTS (
            SELECT 1 FROM public.professionals p
            WHERE p.id = professional_service_authorizations.professional_id
            AND p.organization_id IN (
                SELECT organization_id FROM public.professionals WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins/Editors can manage authorizations" ON public.professional_service_authorizations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.professionals requester
            WHERE requester.user_id = auth.uid()
            AND requester.role IN ('admin', 'editor')
            AND requester.organization_id = (
                SELECT organization_id FROM public.professionals target 
                WHERE target.id = professional_service_authorizations.professional_id
            )
        )
    );
