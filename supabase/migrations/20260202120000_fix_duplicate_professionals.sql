-- Migration: Fix Duplicate Professionals (Corrected)
-- Description: Deletes duplicate professional entries for the same user, keeping the most recent one (based on created_at).
-- Also adds a UNIQUE constraint to prevent future duplicates.

-- 1. Create a temporary table with IDs to keep (the most recent one per user)
CREATE TEMP TABLE keep_ids AS
SELECT DISTINCT ON (user_id) id
FROM professionals
ORDER BY user_id, created_at DESC;

-- 2. Delete rows that are NOT in the keep_ids list
DELETE FROM professionals
WHERE id NOT IN (SELECT id FROM keep_ids);

-- 3. Add Unique Constraint to prevent recurrence
ALTER TABLE professionals
ADD CONSTRAINT professionals_user_id_key UNIQUE (user_id);
