-- Mock RPC: Link Stripe
-- Simulates a successful OAuth flow by inserting secrets.

CREATE OR REPLACE FUNCTION api_v1_mock_stripe_link(
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only Admin
    IF public.get_my_role() != 'admin' THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- Insert/Update fake secret
    INSERT INTO public.organization_secrets (organization_id, stripe_account_id, stripe_status)
    VALUES (p_org_id, 'acct_mock_12345', 'active')
    ON CONFLICT (organization_id) 
    DO UPDATE SET stripe_status = 'active';

    RETURN jsonb_build_object('success', true);
END;
$$;
