-- Optimize Professional Service Authorizations
-- Indexes for efficient Matching Engine queries

-- 1. Composite Index for (professional_id, service_id) - Already unique, but ensures fast lookups
CREATE INDEX IF NOT EXISTS idx_pro_service_auth ON public.professional_service_authorizations(professional_id, service_id);

-- 2. Index for Finding Pros by Service + Priority (Matching Engine Core)
CREATE INDEX IF NOT EXISTS idx_service_priority_skill ON public.professional_service_authorizations(service_id, priority DESC, skill_level);
