-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Allow Admins and Editors to UPDATE their own organization
CREATE POLICY "Admins and Editors can update own organization"
ON public.organizations
FOR UPDATE
USING (
    id IN (
        SELECT organization_id FROM public.professionals 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'editor')
    )
)
WITH CHECK (
    id IN (
        SELECT organization_id FROM public.professionals 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'editor')
    )
);

-- Allow ALL authenticated users to READ organizations (needed for App, Search, etc.)
-- Or maybe public traverse? For now, authenticad users at least.
CREATE POLICY "Public/Auth users can view organizations"
ON public.organizations
FOR SELECT
USING (true);

-- Allow professionals to INSERT (if they create an org? - usually via RPC but good to have if needed)
-- NOTE: Org creation is currently implicit or via specific flow but rarely direct INSERT by user.
-- Keeping it tight: Update only.
