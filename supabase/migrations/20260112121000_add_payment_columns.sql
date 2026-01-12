-- Add Payment Columns to Sessions Table
-- To store financial snapshot at completion.

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10, 2), -- Total price charged (excl tax or inclusive depending on policy, assuming basic amount)
ADD COLUMN IF NOT EXISTS commission DECIMAL(10, 2),   -- YouCanGo cut
ADD COLUMN IF NOT EXISTS pro_payout DECIMAL(10, 2),   -- Pro cut
ADD COLUMN IF NOT EXISTS client_reward DECIMAL(10, 2); -- Cashback/Reward

COMMENT ON COLUMN public.sessions.final_amount IS 'Total amount charged for the service';
COMMENT ON COLUMN public.sessions.commission IS 'Platform fee';
COMMENT ON COLUMN public.sessions.pro_payout IS 'Amount to be transferred to the professional';
COMMENT ON COLUMN public.sessions.client_reward IS 'Rewards credited to the client';
