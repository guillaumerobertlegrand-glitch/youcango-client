"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step1IdentityPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);

    // Identity State
    const [siret, setSiret] = useState("");
    const [officialName, setOfficialName] = useState("");
    const [apeCode, setApeCode] = useState("");

    useEffect(() => {
        async function init() {
            try {
                // Auth Check
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.push("/login");

                // Get Pro & Org
                const { data: pro } = await supabase
                    .from('professionals')
                    .select('organization_id, organization:organizations(id, siret, official_name, ape_code)')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (pro && pro.organization) {
                    setOrgId(pro.organization_id);
                    // @ts-ignore
                    const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;
                    setSiret(org.siret || "");
                    setOfficialName(org.official_name || "");
                    setApeCode(org.ape_code || "");
                } else {
                    router.push("/onboardingpro"); // Back to Dispatcher if no org
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [router, supabase]);

    const saveIdentity = async () => {
        if (!orgId) return;
        const { error } = await supabase.from('organizations').update({
            siret,
            official_name: officialName,
            ape_code: apeCode
        }).eq('id', orgId);

        if (error) alert("Erreur : " + error.message);
        else alert("Modification enregistrée.");
    };

    const handleNext = async () => {
        if (!orgId) return;
        setLoading(true);

        // RPC Validation
        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', {
            p_step: 1,
            p_org_id: orgId
        });

        if (result.valid) {
            // Update Step to 2
            await supabase.from('organizations').update({ onboarding_step: 2 }).eq('id', orgId);
            router.push("/onboardingpro/step-2-finance");
        } else {
            alert("Validation échouée : Vérifiez que tous les champs sont remplis.");
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">Étape 1 : Identité Légale</h1>
            <p className="text-gray-500">Renseignez les informations légales de votre entreprise.</p>

            <div className="space-y-4 border p-6 rounded bg-white shadow-sm">
                <div className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">SIRET</label>
                        <input className="border p-2 rounded w-full" placeholder="Ex: 123 456 789 00012" value={siret} onChange={e => setSiret(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Raison Sociale</label>
                        <input className="border p-2 rounded w-full" placeholder="Ex: Ma Boulangerie SAS" value={officialName} onChange={e => setOfficialName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Code APE</label>
                        <input className="border p-2 rounded w-full" placeholder="Ex: 5610A" value={apeCode} onChange={e => setApeCode(e.target.value)} />
                    </div>
                </div>
                <Button onClick={saveIdentity} variant="outline" size="sm">Sauvegarder Brouillon</Button>
            </div>

            <Button onClick={handleNext} className="w-full">Valider & Suivant</Button>
        </div>
    );
}
