
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { email, organization_id, first_name, last_name } = await request.json();

        if (!email || !organization_id) {
            return NextResponse.json({ error: "Email and Organization ID are required" }, { status: 400 });
        }

        // 1. Verify Permission & Create DB Record (RPC)
        // We use the USER'S client to call RPC, so RLS security checks (get_my_role = admin) apply naturally.
        const { data: inviteData, error: inviteError } = await supabase.rpc('api_v1_invite_editor', {
            p_org_id: organization_id,
            p_email: email,
            p_first_name: first_name || "Invited",
            p_last_name: last_name || "User"
        });

        if (inviteError) {
            console.error("RPC Error:", inviteError);
            return NextResponse.json({ error: inviteError.message }, { status: 403 });
        }

        if (!inviteData.success) {
            return NextResponse.json({ error: inviteData.error }, { status: 403 });
        }

        // 2. Trigger Auth Invite (Admin Client)
        // Now that DB record is safely created/validated by RPC, we send the email.
        const supabaseAdmin = createAdminClient();
        const { error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                role: 'editor',
                organization_id: organization_id,
                first_name: first_name,
                last_name: last_name
            }
            // redirectTo: 'https://youcango-app.com/pro/onboarding' // Optional
        });

        if (authError) {
            console.error("Auth Invite Error:", authError);
            return NextResponse.json({ error: "Failed to send invitation email." }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Invitation sent successfully." });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
