
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBusinessTypes() {
    console.log("🕵️‍♂️ Auditing Business Types for MVP Sectors...");

    const prefixes = ['56', '45.20', '96.02A', '96.02B'];

    // Construct OR query for Supabase is tricky with LIKE, let's just fetch all and filter in memory for this audit or use raw RPC if usually available, but simple select is safer.
    // Actually we can use textSearch or ilike with modifiers, but let's grab all orgs to be sure we see formatting.

    const { data: orgs, error } = await supabase
        .from('organizations')
        .select('id, name, ape_code, business_type, category');

    if (error) {
        console.error("❌ Error fetching orgs:", error);
        return;
    }

    console.log(`✅ Fetched ${orgs.length} total organizations.`);

    let issuesFound = 0;

    orgs.forEach((org: any) => {
        const ape = org.ape_code || '';
        let shouldBeService = false;

        // Check if APE matches our target list
        if (ape.startsWith('56') || ape.startsWith('45.20') || ape.startsWith('96.02A') || ape.startsWith('96.02B')) {
            shouldBeService = true;
        }

        // Also check "clean" versions if APE has dots or spaces differently
        const cleanApe = ape.replace(/\./g, '');
        if (cleanApe.startsWith('56') || cleanApe.startsWith('4520') || cleanApe.startsWith('9602A') || cleanApe.startsWith('9602B')) {
            // If we want to be strict, maybe we missed these?
        }

        if (shouldBeService) {
            if (org.business_type !== 'service') {
                console.log(`⚠️ MISMATCH: [${org.name}] (APE: ${ape}) has type '${org.business_type}'. Expected 'service'.`);
                issuesFound++;
            } else {
                console.log(`✅ OK: [${org.name}] (APE: ${ape}) is '${org.business_type}'.`);
            }
        }
    });

    if (issuesFound === 0) {
        console.log("\n🎉 All target sectors appear to be 'service'.");
    } else {
        console.log(`\n❌ Found ${issuesFound} organizations that should be 'service' but aren't.`);
    }
}

checkBusinessTypes();
