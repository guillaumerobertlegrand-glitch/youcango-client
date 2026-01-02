import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ClientHome from "@/components/ClientHome";
import { checkProfileCompletion } from "@/utils/profile-check";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  // Onboarding Check
  const isProfileComplete = await checkProfileCompletion();
  if (isProfileComplete === false) {
    redirect("/onboarding");
  }

  const { data: { user } } = await supabase.auth.getUser();

  // On récupère les magasins autour de Paris par défaut
  const { data: stores } = await supabase.rpc('find_nearby_stores', {
    search_lat: 48.8566,
    search_long: 2.3522,
    radius_meters: 50000
  });

  return (
    <ClientHome
      initialStores={stores || []}
      userEmail={user?.email || "demo-mode@test.com"}
    />
  );
}
