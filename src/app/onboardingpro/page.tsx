"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OnboardingDispatcher() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Creation Form
    const [newOrgName, setNewOrgName] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    useEffect(() => {
        async function checkState() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.push("/login");

                const { data: pro } = await supabase
                    .from('professionals')
                    .select('organization:organizations(onboarding_step)')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (pro && pro.organization) {
                    // Organization exists -> Redirect to Current Step
                    // @ts-ignore
                    const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;
                    const step = org.onboarding_step || 1;
                    router.push(`/onboardingpro/step-${step}`);
                } else {
                    // No Org -> Show Creation Form
                    setIsCreating(true);
                    setLoading(false);
                }
            } catch (e) {
                console.error("Dispatcher Error:", e);
                setLoading(false);
            }
        }
        checkState();
    }, [supabase, router]);

    const handleCreateOrg = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('api_v1_bootstrap_organization', {
            p_org_name: newOrgName,
            p_first_name: firstName,
            p_last_name: lastName
        });

        if (error) {
            alert("Creation Failed: " + error.message);
            setLoading(false);
        } else {
            // Created! Redirect to Step 1
            router.push("/onboardingpro/step-1");
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    if (isCreating) {
        return (
            <div className="p-6 space-y-8 max-w-md mx-auto mt-10 border rounded bg-slate-50 shadow-lg">
                <h1 className="text-2xl font-bold text-center">Bienvenue sur YouCanGo Pro !</h1>
                <p className="text-center text-gray-600">Pour commencer, créez votre organisation.</p>
                <div className="space-y-4">
                    <input className="border p-2 w-full rounded" placeholder="Nom de votre Entreprise (Enseigne)" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} />
                    <div className="flex gap-2">
                        <input className="border p-2 w-full rounded" placeholder="Votre Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} />
                        <input className="border p-2 w-full rounded" placeholder="Votre Nom" value={lastName} onChange={e => setLastName(e.target.value)} />
                    </div>
                    <Button onClick={handleCreateOrg} className="w-full">Créer mon Espace</Button>
                </div>
            </div>
        )
    }

    return null; // Should redirect
}
