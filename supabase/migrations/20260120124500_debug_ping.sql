-- Ping function
CREATE OR REPLACE FUNCTION api_v1_debug_ping()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN '{"pong": true}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION api_v1_debug_ping TO anon, authenticated, service_role;
