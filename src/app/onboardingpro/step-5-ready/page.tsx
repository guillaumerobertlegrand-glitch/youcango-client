"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Rocket, Briefcase, Zap, CheckCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step5ReadyPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [pro, setPro] = useState<any>(null);
    const [org, setOrg] = useState<any>(null);

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            const { data: proRes } = await supabase.from('professionals').select('*, organizations(*)').eq('user_id', user.id).maybeSingle();

            if (proRes) {
                setPro(proRes);
                setOrg(proRes.organizations);
            } else {
                router.push("/onboardingpro");
            }
            setLoading(false);
        }
        init();
    }, [router, supabase]);

    const handleLaunch = async () => {
        if (!org?.id) return;
        setLoading(true);

        const { data, error } = await supabase.rpc('api_v1_complete_onboarding', { p_org_id: org.id });

        if (error || !data.success) {
            console.error("Launch Error:", data);
            let msg = error?.message || data?.error;
            if (data?.steps) {
                const fails = Object.entries(data.steps)
                    .filter(([_, val]: [string, any]) => !val.valid)
                    .map(([step, val]: [string, any]) => `Étape ${step}: ${(val as any).details ? JSON.stringify((val as any).details) : 'Invalide'}`)
                    .join('\n');
                if (fails) msg += `\n\n${fails}`;
            }
            alert("Erreur de lancement :\n" + msg);
            setLoading(false);
        } else {
            router.push("/pro");
        }
    };

    const handleAccess = () => {
        router.push("/pro");
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    const isAdmin = pro?.role === 'admin';
    const isAlreadyActive = org?.onboarding_status === 'completed';

    // SCENARIO 2: WELCOME (User or Already Active)
    if (!isAdmin || isAlreadyActive) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center space-y-8 mt-10">
                <div className="flex justify-center">
                    <div className="bg-green-100 p-4 rounded-full">
                        <Store className="w-12 h-12 text-green-600" />
                    </div>
                </div>

                <div>
                    <h1 className="text-3xl font-bold mb-2">Ravi de vous voir, {pro?.first_name} !</h1>
                    <p className="text-gray-600">
                        Vous faites partie de l'équipe <strong>{org?.official_name || 'Votre Établissement'}</strong>.
                    </p>
                </div>

                <Button onClick={handleAccess} size="lg" className="w-full text-lg py-6 bg-blue-600 hover:bg-blue-700">
                    Accéder à mon interface Pro
                </Button>
            </div>
        );
    }

    // SCENARIO 1: LAUNCHPAD (Admin + Onboarding In Progress)
    return (
        <div className="p-6 max-w-3xl mx-auto space-y-10">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-gray-900">Prêt au décollage ? 🚀</h1>
                <p className="text-gray-500 text-lg">Récapitulatif avant ouverture</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                {/* Métier */}
                <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center text-center">
                    <Briefcase className="w-8 h-8 text-blue-500 mb-3" />
                    <h3 className="font-semibold text-gray-900">Activité</h3>
                    <p className="text-sm text-gray-500 mt-1">{org?.business_type || 'Non spécifié'}</p>
                </div>

                {/* Services */}
                <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center text-center">
                    <Zap className="w-8 h-8 text-purple-500 mb-3" />
                    <h3 className="font-semibold text-gray-900">Services</h3>
                    <p className="text-sm text-gray-500 mt-1">Configurés & Prêts</p>
                </div>

                {/* Commission */}
                <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-bl">OFFRE LANCEMENT</div>
                    <div className="text-2xl font-bold text-green-600 mb-1">5%</div>
                    <h3 className="font-semibold text-gray-900 text-sm">Commission</h3>
                    <p className="text-xs text-gray-400 mt-1">Au lieu de 15% (Précurseur)</p>
                </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Dernières Vérifications
                </h3>
                <ul className="text-sm text-gray-600 space-y-1 ml-7 list-disc">
                    <li>Identité juridique vérifiée</li>
                    <li>Compte de paiement connecté</li>
                    <li>Terminaux assignés à l'équipe</li>
                </ul>
            </div>

            <Button onClick={handleLaunch} size="lg" className="w-full bg-black hover:bg-gray-800 text-white text-lg py-8 rounded-xl shadow-lg transition-transform hover:scale-[1.02]">
                Lancer mon activité
            </Button>

            <p className="text-xs text-center text-gray-400">
                En cliquant sur "Lancer", votre établissement sera visible sur YouCanGo.
            </p>
        </div>
    );
}
