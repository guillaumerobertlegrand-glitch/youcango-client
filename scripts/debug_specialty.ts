
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSpecialty() {
    console.log("🕵️‍♂️ Debugging Specialty Display...");

    // 1. Fetch Restaurants (Merchants)
    console.log("👉 Fetching 'merchant' (Restaurants)...");
    const { data: merchants, error: err1 } = await supabase.rpc('api_v1_get_merchants', {
        p_lat: 48.8566,
        p_long: 2.3522,
        p_category: 'merchant',
        p_keywords: [], // No keyword filter to see ALL
        p_radius_meters: 50000,
        p_viewer_id: null
    });

    if (err1) console.error("❌ Error fetching merchants:", err1);
    else {
        console.log(`✅ Found ${merchants.length} merchants.`);
        merchants.forEach((m: any) => {
            console.log(` - [${m.name}] Type: ${m.business_type}, Cat: ${m.category}, Spec: "${m.specialty_label}" (${typeof m.specialty_label})`);
        });
    }

    // 2. Fetch Services (Coiffeurs)
    console.log("\n👉 Fetching 'service' (Coiffeurs)...");
    const { data: services, error: err2 } = await supabase.rpc('api_v1_get_merchants', {
        p_lat: 48.8566,
        p_long: 2.3522,
        p_category: 'service',
        p_keywords: [],
        p_radius_meters: 50000,
        p_viewer_id: null
    });

    if (err2) console.error("❌ Error fetching services:", err2);
    else {
        console.log(`✅ Found ${services.length} services.`);
        services.slice(0, 5).forEach((m: any) => {
            console.log(` - [${m.name}] Type: ${m.business_type}, Cat: ${m.category}, Spec: "${m.specialty_label}" (${typeof m.specialty_label})`);
        });
    }
}

debugSpecialty();
