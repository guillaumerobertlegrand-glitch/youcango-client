-- cleanup_bootstrap_duplicates.sql
-- Dynamically drop all overrides of api_v1_bootstrap_organization to clean up the schema.

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure as func_signature
        FROM pg_proc 
        WHERE proname = 'api_v1_bootstrap_organization'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.func_signature;
    END LOOP;
END $$;
