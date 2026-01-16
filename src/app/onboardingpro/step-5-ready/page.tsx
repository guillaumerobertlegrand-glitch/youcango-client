"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step5ReadyPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            const { data: pro } = await supabase.from('professionals').select('organization_id').eq('user_id', user.id).maybeSingle();
            if (pro) {
                setOrgId(pro.organization_id);
            } else {
                router.push("/onboardingpro");
            }
            setLoading(false);
        }
        init();
    }, [router, supabase]);

    const handleLaunch = async () => {
        if (!orgId) return;
        setLoading(true);

        const { data, error } = await supabase.rpc('api_v1_complete_onboarding', { p_org_id: orgId });

        if (error || !data.success) {
            console.error("Launch Error:", data);
            let msg = error?.message || data?.error;

            // Extract details
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
            // Success! Redirect to Dashboard
            router.push("/pro");
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-2xl mx-auto text-center">
            <div className="flex justify-center mb-6">
                <CheckCircle className="w-24 h-24 text-green-500" />
            </div>

            <h1 className="text-3xl font-bold">Tout est prêt ! 🚀</h1>
            <p className="text-gray-600 text-lg">
                Votre organisation est configurée.<br />
                Vous pouvez maintenant accéder à votre tableau de bord et commencer à recevoir des demandes.
            </p>

            <div className="pt-8">
                <Button onClick={handleLaunch} size="lg" className="w-full bg-green-600 hover:bg-green-700 text-lg py-6">
                    Lancer mon Espace Pro
                </Button>
            </div>
        </div>
    );
}
