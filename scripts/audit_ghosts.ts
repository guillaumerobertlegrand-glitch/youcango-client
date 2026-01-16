
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGhosts() {
    console.log("👻 Checking for Ghost Organizations (No Location)...");

    const { count: orgCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
    const { count: locCount } = await supabase.from('locations').select('*', { count: 'exact', head: true });

    console.log(`📊 Stats: ${orgCount} Orgs, ${locCount} Locations.`);

    const { data: ghosts, error } = await supabase
        .from('organizations')
        .select('id, name, created_at')
        .not('id', 'in', (
            supabase.from('locations').select('organization_id')
        ) as any); // Type hack/Subquery simulation - Supabase JS doesn't support NOT IN subquery easily this way

    // Better way: Fetch all org IDs and Loc Org IDs.
    const { data: allOrgs } = await supabase.from('organizations').select('id, name, created_at');
    const { data: allLocs } = await supabase.from('locations').select('organization_id');

    const locOrgIds = new Set(allLocs?.map(l => l.organization_id));
    const realGhosts = allOrgs?.filter(o => !locOrgIds.has(o.id)) || [];

    console.log(`👻 Found ${realGhosts.length} organizations without location:`);
    realGhosts.forEach(g => console.log(` - [${g.name}] (${g.created_at})`));

    // Also check PROS availability
    const { data: pros } = await supabase.from('professionals').select('id, status, organization_id');
    console.log("\n👷 Professional Statuses:");
    realGhosts.forEach(g => {
        const pro = pros?.find(p => p.organization_id === g.id);
        console.log(` - ${g.name}: Pro Status = ${pro?.status || 'MISSING'}`);
    });
}

checkGhosts();
