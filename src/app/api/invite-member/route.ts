
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
        let { email, organization_id, first_name, last_name, role = 'editor' } = await request.json();

        // 0. Security Sanitization
        email = email?.trim();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        if (!email || !organization_id) {
            return NextResponse.json({ error: "Email and Organization ID are required" }, { status: 400 });
        }

        if (!emailRegex.test(email)) {
            console.error("Invite Blocked: Invalid Email Format", { email });
            return NextResponse.json({ error: "Format email invalide" }, { status: 400 });
        }

        // 1. Verify Permission & Create DB Record (RPC)
        // Default role is always 'member' for invitations now.
        const targetRole = 'member';

        const { data: inviteData, error: inviteError } = await supabase.rpc('api_v1_invite_member', {
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

        // 1.5 Create Placeholder in 'professionals' Table (CRITICAL FIX)
        // This ensures the user exists for onboarding logic even before they log in.
        // We use the email as a temporary anchor, or we wait for them to claim it.
        // Actually, 'api_v1_invite_member' might NOT create a professional record.
        // Let's force create it here to be safe and consistent with "Step 4 creates members".

        // Check if exists first
        const { data: existingPro } = await supabase
            .from('professionals')
            .select('id')
            .eq('email', email)
            .eq('organization_id', organization_id)
            .maybeSingle();

        if (!existingPro) {
            const { error: proCreateError } = await supabase.from('professionals').insert({
                organization_id: organization_id,
                email: email,
                first_name: first_name,
                last_name: last_name,
                role: targetRole,
                job_title: 'Membre',
                user_id: null // Will be linked on claim
            });

            if (proCreateError) {
                console.error("DEBUG INSERT PROFESSIONALS:", proCreateError);
                return NextResponse.json({
                    error: "Database Error: Impossible de créer le membre (Professionals Table). " + proCreateError.message
                }, { status: 500 });
            }
        }

        // 2. Trigger Auth Invite (Admin Client)
        const supabaseAdmin = createAdminClient();


        const { error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                role: targetRole,
                organization_id: organization_id,
                first_name: first_name,
                last_name: last_name
            },
            redirectTo: `${new URL(request.url).origin}/auth/callback`
        });

        if (authError) {
            console.error("Auth Invite Error:", authError);
            console.log("DÉTAIL TECHNIQUE DE L'ERREUR (Auth):", authError);
            return NextResponse.json({
                error: `Failed to send invitation email: ${authError.message}`
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Invitation sent successfully." });

    } catch (error: any) {
        console.error("API Error:", error);
        console.log("DÉTAIL TECHNIQUE DE L'ERREUR :", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
