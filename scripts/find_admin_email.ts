
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Use Service Role Key for Admin Access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log("Searching for Vincent LIMOUZIN...");

    // 1. Find Pro ID
    const { data: pros, error } = await supabase
        .from('professionals')
        .select('id, user_id, first_name, last_name')
        .ilike('last_name', '%LIMOUZIN%');

    if (error || !pros || pros.length === 0) {
        console.error("Pro not found:", error);
        return;
    }

    const pro = pros[0];
    console.log(`Found Pro: ${pro.first_name} ${pro.last_name} (User ID: ${pro.user_id})`);

    if (!pro.user_id) {
        console.error("This pro has no linked User ID!");
        return;
    }

    // 2. Get Auth User
    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(pro.user_id);

    if (authError || !user) {
        console.error("Auth User lookup failed:", authError);
        return;
    }

    console.log("\n------------------------------------------------");
    console.log(`📧 EMAIL FOUND: ${user.email}`);
    console.log("------------------------------------------------\n");
}

main();
