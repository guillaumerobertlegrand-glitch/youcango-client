
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const orgId = '1abe6ea9-25d3-4d03-b7c2-b692ff1b8a4e'; // LA TOMATE
    console.log(`Checking secrets for ${orgId}...`);

    const { data, error } = await supabase
        .from('organization_secrets')
        .select('*')
        .eq('organization_id', orgId);

    console.log("Secrets Data:", data);
    console.log("Error:", error);
}

check();
