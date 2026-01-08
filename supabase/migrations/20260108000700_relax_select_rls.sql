-- Relax RLS for SELECT on sessions to ensure Pro (Anon/Auth) receives Realtime updates
-- Crucial for Demo where Pro might not be logged in as the specific Organization Owner

DROP POLICY IF EXISTS "Enable select for anon/authenticated sessions" ON "public"."sessions";

CREATE POLICY "Enable select for anon/authenticated sessions"
ON "public"."sessions"
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);
