
-- Find users with multiple professional entries
SELECT user_id, count(*) as count
FROM professionals
GROUP BY user_id
HAVING count(*) > 1;

-- List details of duplicates to decide which one to keep
SELECT *
FROM professionals
WHERE user_id IN (
    SELECT user_id
    FROM professionals
    GROUP BY user_id
    HAVING count(*) > 1
);
