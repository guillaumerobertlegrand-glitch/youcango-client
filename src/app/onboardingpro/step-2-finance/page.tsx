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
        <div className="flex flex-col min-h-full">
            <div className="flex-grow p-4 space-y-6">
                <header>
                    <h1 className="text-xl font-bold text-slate-900">Connexion Bancaire</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Connectez votre compte Stripe pour recevoir vos paiements.
                    </p>
                </header>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#635BFF]/10 p-2.5 rounded-lg">
                            <span className="text-[#635BFF] font-bold text-lg">S</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">Stripe Connect</h3>
                            <p className="text-xs text-slate-500">Paiement sécurisé</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed">
                        YouCanGo utilise Stripe pour garantir la sécurité de vos transactions et le virement automatique de vos revenus.
                    </p>

                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                            <span className="text-indigo-900 text-xs font-semibold uppercase tracking-wider">Environnement de Test</span>
                        </div>
                        <Button onClick={mockStripe} className="w-full bg-[#635BFF] hover:bg-[#534BCF] text-white shadow-lg shadow-indigo-200">
                            Connecter mon compte Stripe
                        </Button>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-100 pb-8">
                <Button onClick={handleNext} className="w-full h-12 text-base font-semibold shadow-xl shadow-slate-200" variant="secondary">
                    Valider & Continuer
                </Button>
            </div>
        </div>
    );
}
