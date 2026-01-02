-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Allow authenticated read for organizations" ON public.organizations;
    DROP POLICY IF EXISTS "Allow authenticated read for locations" ON public.locations;
    DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
    DROP POLICY IF EXISTS "Users can create own sessions" ON public.sessions;
    DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;
    DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
    DROP POLICY IF EXISTS "Service role full access" ON public.organizations;
    DROP POLICY IF EXISTS "Service role full access" ON public.locations;
    DROP POLICY IF EXISTS "Service role full access" ON public.sessions;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Organizations: Authenticated users can view all organizations
CREATE POLICY "Allow authenticated read for organizations" ON public.organizations
FOR SELECT TO authenticated USING (true);

-- Locations: Authenticated users can view all locations
CREATE POLICY "Allow authenticated read for locations" ON public.locations
FOR SELECT TO authenticated USING (true);

-- Sessions: Users can manage only their own sessions
CREATE POLICY "Users can view own sessions" ON public.sessions
FOR SELECT TO authenticated USING (auth.uid() = customer_id);

CREATE POLICY "Users can create own sessions" ON public.sessions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Users can update own sessions" ON public.sessions
FOR UPDATE TO authenticated USING (auth.uid() = customer_id);
