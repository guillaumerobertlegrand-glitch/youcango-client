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
            <div className="flex flex-col min-h-full">
                <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-8">
                    <div className="bg-blue-50 p-6 rounded-full mb-4">
                        <Store className="w-12 h-12 text-blue-600" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bonjour {pro?.first_name} !</h1>
                        <p className="text-slate-500">
                            Bienvenue dans l'espace équipe de <br />
                            <span className="font-bold text-slate-900">{org?.official_name || 'Votre Établissement'}</span>.
                        </p>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-100 pb-8">
                    <Button onClick={handleAccess} className="w-full h-14 text-lg font-bold shadow-xl shadow-blue-200 bg-blue-600 hover:bg-blue-700 text-white">
                        Accéder à l'interface
                    </Button>
                </div>
            </div>
        );
    }

    // SCENARIO 1: LAUNCHPAD (Admin + Onboarding In Progress)
    return (
        <div className="flex flex-col min-h-full">
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-8">

                {/* Celebration Icon */}
                <div className="relative">
                    <div className="absolute inset-0 bg-green-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                    <div className="bg-white p-6 rounded-full shadow-xl relative z-10 border border-slate-50">
                        <CheckCircle className="w-16 h-16 text-green-500" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Configuration Terminée !</h1>
                    <p className="text-slate-500 max-w-xs mx-auto leading-relaxed">
                        Votre espace <span className="font-bold text-slate-800">YouCanGo Pro</span> est prêt à l'emploi.
                    </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 w-full max-w-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Récapitulatif</h3>
                    <ul className="space-y-3 text-left">
                        <li className="flex items-center gap-3 text-sm text-slate-700">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3.5 h-3.5" />
                            </div>
                            Identité & Horaires
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-700">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3.5 h-3.5" />
                            </div>
                            Paiements (Stripe)
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-700">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3.5 h-3.5" />
                            </div>
                            Catalogue de Services
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-700">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircle className="w-3.5 h-3.5" />
                            </div>
                            Équipe & Terminaux
                        </li>
                    </ul>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-100 pb-8">
                <Button onClick={handleLaunch} className="w-full h-14 text-lg font-bold shadow-xl shadow-green-200 bg-slate-900 hover:bg-black text-white hover:scale-[1.02] transition-transform">
                    Lancer YouCanGo Pro 🚀
                </Button>
            </div>
        </div>
    );
}
