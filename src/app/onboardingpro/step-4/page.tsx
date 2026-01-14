"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step4Page() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            const { data: pro } = await supabase.from('professionals').select('organization_id').eq('user_id', user.id).single();
            if (pro) setOrgId(pro.organization_id);
            setLoading(false);
        }
        init();
    }, []);

    const handleComplete = async () => {
        if (!orgId) return;
        setLoading(true);

        const { data, error } = await supabase.rpc('api_v1_complete_onboarding', { p_org_id: orgId });
        if (error || !data.success) {
            alert("Completion Failed: " + (error?.message || data?.error));
            setLoading(false);
        } else {
            router.push('/pro');
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">Étape 4 : Habilitations</h1>
            <div className="border p-4 rounded bg-slate-50">
                <p>Vérifiez la matrice de compétences.</p>
            </div>
            <Button onClick={handleComplete} className="w-full bg-green-600 hover:bg-green-700">Terminer & Lancer</Button>
        </div>
    );
}
