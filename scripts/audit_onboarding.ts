
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function audit() {
    console.log("🔍 Starting Onboarding Audit...");

    // 1. Get Latest Org
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*, organization_secrets(stripe_account_id)')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (orgError) {
        console.error("❌ Failed to fetch organization:", orgError);
        return;
    }

    console.log(`\n🏢 Organization: ${org.name} (${org.id})`);
    console.log(`   - Status: ${org.onboarding_step === 5 ? 'COMPLETED (Step 5)' : `Step ${org.onboarding_step}`} (Note: 'status' column might be deprecated, checking step)`);
    console.log(`   - APE Code: ${org.ape_code} ${org.ape_code ? '✅' : '❌'}`);

    // Check Stripe (Joined from secrets)
    const stripeId = org.organization_secrets?.[0]?.stripe_account_id;
    console.log(`   - Stripe ID: ${stripeId || 'NULL'} ${stripeId ? '✅' : '❌'}`);

    // 2. Professionals
    const { data: pros, error: proError } = await supabase
        .from('professionals')
        .select('*')
        .eq('organization_id', org.id);

    if (proError) console.error("❌ Pros Error:", proError);
    else {
        console.log(`\n👥 Professionals (${pros.length}):`);
        for (const p of pros) {
            // Check is_onboarded if exists, else infer
            const isOnboarded = p.is_onboarded ?? "N/A (Column missing)";
            console.log(`   - ${p.first_name} ${p.last_name} (${p.role})`);
            console.log(`     - Status: ${p.status}`);
            console.log(`     - Is Onboarded: ${isOnboarded} ${isOnboarded === true ? '✅' : ''}`); // Adjust check if strict true
        }
    }

    // 3. Services
    const { data: services, error: servError } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', org.id);

    console.log(`\n🛒 Services: ${services?.length || 0} ${services?.length ? '✅' : '❌'}`);

    // 4. Devices
    const { data: devices, error: devError } = await supabase
        .from('devices')
        .select('*')
        .eq('organization_id', org.id);

    console.log(`\n📱 Devices: ${devices?.length || 0} ${devices?.length ? '✅' : '❌'}`);
    devices?.forEach(d => console.log(`   - ${d.name} (${d.status}) -> Pro: ${d.pro_id || 'Unassigned'}`));

    // 5. Authorizations (Solo Mode check)
    // Assuming table name 'professional_service_authorizations' based on convention
    // Verify if any authorizations exist for the Admin
    if (pros && pros.length > 0) {
        const admin = pros.find(p => p.role === 'admin');
        if (admin) {
            const { data: auths, error: authError } = await supabase
                .from('professional_service_authorizations')
                .select('*')
                .eq('professional_id', admin.id);

            if (authError) {
                // Try fallback table name if error
                console.log(`   - Auth Check: Table 'professional_service_authorizations' might not exist or empty.`);
            } else {
                console.log(`\n🔑 Authorizations (Admin): ${auths?.length || 0} ${auths?.length ? '✅' : '❌ (Solo mode should have auto-auth)'}`);
            }
        }
    }
}

audit();
