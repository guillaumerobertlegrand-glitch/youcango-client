
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function checkProfileCompletion() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Check if profile has necessary fields
    // Since we don't have direct access to 'public.profiles' via simple auth.getUser(), 
    // we rely on metadata for now OR we fetch the profile.
    // Ideally, we fetch the profile table. `init_users_security.sql` copies metadata to profile, 
    // so checking metadata might be a fast proxy, but checking the real table is safer.

    const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', user.id)
        .single();

    if (!profile || !profile.first_name || !profile.last_name) {
        return false; // Incomplete
    }

    return true; // Complete
}
