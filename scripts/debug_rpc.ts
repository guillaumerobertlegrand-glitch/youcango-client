
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Check with Admin key to bypass RLS first, then we check regular
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRpc() {
    console.log("🕵️‍♂️ Debugging api_v1_get_merchants...");

    const params = {
        p_lat: 48.8566,
        p_long: 2.3522,
        p_category: null,
        p_keywords: [],
        p_radius_meters: 50000, // Large radius
        p_viewer_id: null
    };

    console.log("👉 Calling RPC with params:", params);

    const { data, error } = await supabase.rpc('api_v1_get_merchants', params);

    if (error) {
        console.error("❌ RPC Error:", error);
    } else {
        console.log(`✅ RPC returned ${data.length} rows.`);
        if (data.length > 0) {
            console.log("First 3 rows:", data.slice(0, 3));
        } else {
            console.log("⚠️ NO DATA returned.");
        }
    }
}

debugRpc();
