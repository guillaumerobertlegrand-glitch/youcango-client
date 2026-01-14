"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step2FinancePage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);

    useEffect(() => {
        async function init() {
            try {
                // Auth Check & Guard
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.push("/login");

                const { data: pro } = await supabase
                    .from('professionals')
                    .select('organization_id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (pro) {
                    setOrgId(pro.organization_id);
                } else {
                    router.push("/onboardingpro");
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [router, supabase]);

    const mockStripe = async () => {
        if (!orgId) return;
        const { error } = await supabase.rpc('api_v1_mock_stripe_link', { p_org_id: orgId });
        if (error) alert("Erreur Stripe: " + error.message);
        else alert("Stripe connecté (Simulation) !");
    };

    const handleNext = async () => {
        if (!orgId) return;
        setLoading(true);

        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', {
            p_step: 2,
            p_org_id: orgId
        });

        if (result.valid) {
            await supabase.from('organizations').update({ onboarding_step: 3 }).eq('id', orgId);
            router.push("/onboardingpro/step-3-catalog");
        } else {
            alert("Veuillez connecter votre compte Stripe pour continuer.");
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">Étape 2 : Finance</h1>
            <p className="text-gray-500">Connectez vos informations bancaires pour recevoir vos paiements.</p>

            <div className="space-y-4 border p-6 rounded bg-white shadow-sm">
                <h3 className="font-semibold text-lg">Stripe Connect</h3>
                <p className="text-sm text-gray-600">
                    Nous utilisons Stripe pour garantir la sécurité de vos transactions.
                    En cliquant ci-dessous, vous serez redirigé vers l'interface de connexion.
                </p>
                <div className="bg-blue-50 p-4 rounded border border-blue-100 flex justify-between items-center">
                    <span className="text-blue-900 font-medium font-mono">Status: Simulé (Mock)</span>
                    <Button onClick={mockStripe} variant="secondary">Connexion Stripe</Button>
                </div>
            </div>

            <Button onClick={handleNext} className="w-full">Valider & Suivant</Button>
        </div>
    );
}
