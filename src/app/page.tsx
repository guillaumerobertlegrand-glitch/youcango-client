import { createClient } from "@/utils/supabase/server";
import ClientHome from "@/components/ClientHome";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  // On ne récupère QUE l'utilisateur pour l'instant
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <ClientHome
      initialStores={[]}
      userEmail={user?.email || "demo-mode@test.com"}
    />
  );
}
