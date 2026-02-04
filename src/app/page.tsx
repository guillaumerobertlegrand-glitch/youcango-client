import { createClient } from "@/utils/supabase/server";
import { Zap, ArrowRight, MapPin } from "lucide-react";
import MapWrapper from "@/components/MapWrapper";
import ClientHome from "@/components/ClientHome";
import { checkProfileCompletion } from "@/utils/profile-check";
import { redirect } from "next/navigation";
import { signout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  // Onboarding Check removed for Demo
  // const isProfileComplete = await checkProfileCompletion();
  // if (isProfileComplete === false) { 
  //   redirect("/onboarding");
  // }

  // Test Logic: Fetch stores around Paris (Hardcoded for demo)
  const { data: stores, error } = await supabase.rpc('find_nearby_stores', {
    search_lat: 48.8566,
    search_long: 2.3522,
    radius_meters: 50000
  });

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <ClientHome
      initialStores={stores || []}
      userEmail={user?.email}
    />
  );
}
