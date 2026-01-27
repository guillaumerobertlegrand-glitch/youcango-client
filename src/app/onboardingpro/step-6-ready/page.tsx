"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Rocket, Briefcase, Zap, CheckCircle, Store, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IOSSection, IOSRow } from "@/components/ui/ios-settings";
import { cn } from "@/lib/utils";

export default function Step6ReadyPage() {
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

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-500" /></div>;

    const isAdmin = pro?.role === 'admin';
    const isAlreadyActive = org?.onboarding_status === 'completed';

    // SCENARIO 2: WELCOME (User or Already Active)
    if (!isAdmin || isAlreadyActive) {
        return (
            <div className="h-full font-sans bg-[#F2F2F7] relative overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto pb-6 flex flex-col items-center pt-20 px-6 text-center">

                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-8">
                        <Store className="w-12 h-12 text-[#007AFF]" />
                    </div>

                    <h1 className="text-[28px] font-bold text-black tracking-tight mb-4">
                        Bonjour {pro?.first_name} !
                    </h1>
                    <p className="text-[17px] text-[#000000] leading-relaxed max-w-xs mx-auto">
                        Bienvenue dans l'espace équipe de <br />
                        <span className="font-semibold">{org?.official_name || 'Votre Établissement'}</span>.
                    </p>

                </div>

                <div className="shrink-0 z-10 relative mt-auto pb-6 pt-2 bg-[#F2F2F7]/80 backdrop-blur-md border-t border-[#C6C6C8]/30">
                    <div className="px-4">
                        <Button
                            onClick={handleAccess}
                            className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-bold text-[17px] h-12 rounded-[16px]"
                        >
                            Accéder à l'interface
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // SCENARIO 1: LAUNCHPAD (Admin + Onboarding In Progress)
    return (
        <div className="h-full font-sans bg-[#F2F2F7] relative overflow-hidden flex flex-col">

            <div className="flex-1 overflow-y-auto pb-6 flex flex-col">

                {/* Hero Section */}
                <div className="flex flex-col items-center pt-16 pb-8 px-6 text-center">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-green-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg relative z-10">
                            <CheckCircle className="w-12 h-12 text-[#34C759]" />
                        </div>
                    </div>

                    <h1 className="text-[28px] font-bold text-black tracking-tight mb-2">
                        Tout est prêt !
                    </h1>
                    <p className="text-[17px] text-[#6b6b70] leading-relaxed max-w-xs mx-auto">
                        Votre espace <span className="font-semibold text-black">YouCanGo Pro</span> est configuré.
                    </p>
                </div>

                {/* Recap Section */}
                <IOSSection title="Récapitulatif">
                    <IOSRow label="Identité & Horaires" separator={true}>
                        <div className="flex items-center text-[#34C759] font-medium text-[15px]">
                            <Check className="w-4 h-4 mr-1" /> Configuré
                        </div>
                    </IOSRow>
                    <IOSRow label="Paiements" separator={true}>
                        <div className="flex items-center text-[#34C759] font-medium text-[15px]">
                            <Check className="w-4 h-4 mr-1" /> Configuré
                        </div>
                    </IOSRow>
                    <IOSRow label="Catalogue" separator={true}>
                        <div className="flex items-center text-[#34C759] font-medium text-[15px]">
                            <Check className="w-4 h-4 mr-1" /> Configuré
                        </div>
                    </IOSRow>
                    <IOSRow label="Équipe" separator={false}>
                        <div className="flex items-center text-[#34C759] font-medium text-[15px]">
                            <Check className="w-4 h-4 mr-1" /> Configuré
                        </div>
                    </IOSRow>
                </IOSSection>

            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 z-10 relative mt-auto pb-6 pt-2 bg-[#F2F2F7]/80 backdrop-blur-md border-t border-[#C6C6C8]/30">
                <div className="px-4">
                    <Button
                        onClick={handleLaunch}
                        className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-bold text-[17px] h-12 rounded-[16px]"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : "Accéder au Dashboard"}
                    </Button>
                </div>
            </div>

        </div>
    );
}
