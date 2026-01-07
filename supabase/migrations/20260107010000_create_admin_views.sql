-- Create convenient views for Admin/Dashboard visibility
-- Note: These views simplify JOINs for easier reading in Supabase Studio.

-- 1. View: ORGANIZATIONS (with Location info)
CREATE OR REPLACE VIEW public.admin_organizations_view AS
SELECT 
    o.id,
    o.name,
    o.business_type,
    o.category,
    o.description,
    l.address,
    l.coordinates::text as coordinates_text,
    o.created_at
FROM 
    public.organizations o
LEFT JOIN 
    public.locations l ON l.organization_id = o.id;

-- 2. View: PROS (Staff & Managers with Org context)
CREATE OR REPLACE VIEW public.admin_pros_view AS
SELECT 
    p.id as pro_id,
    p.first_name,
    p.last_name,
    p.role,
    p.status,
    o.name as organization_name,
    p.user_id as linked_auth_id,
    p.created_at
FROM 
    public.professionals p
JOIN 
    public.organizations o ON p.organization_id = o.id;

-- 3. View: SESSIONS (The core transaction log)
CREATE OR REPLACE VIEW public.admin_sessions_view AS
SELECT 
    s.id as session_id,
    s.created_at,
    s.state,
    s.service_requested,
    s.monetization_model,
    s.arrival_timing,
    -- Customer Info
    cust.full_name as customer_name,
    s.customer_id,
    -- Provider Info
    org.name as provider_name,
    loc.address as provider_address
FROM 
    public.sessions s
LEFT JOIN 
    public.profiles cust ON s.customer_id = cust.id
LEFT JOIN 
    public.locations loc ON s.location_id = loc.id
LEFT JOIN 
    public.organizations org ON loc.organization_id = org.id
ORDER BY 
    s.created_at DESC;
