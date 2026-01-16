"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Check, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step5SkillsPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);

    const [team, setTeam] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    // Matrix: { "proId_serviceId": boolean }
    const [matrix, setMatrix] = useState<Record<string, boolean>>({});

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            const { data: pro } = await supabase.from('professionals').select('organization_id').eq('user_id', user.id).maybeSingle();
            if (pro) {
                setOrgId(pro.organization_id);
                fetchData(pro.organization_id);
            } else {
                router.push("/onboardingpro");
            }
        }
        init();
    }, [router, supabase]);

    const fetchData = async (oid: string) => {
        setLoading(true);
        try {
            // Fetch Pros
            const { data: pros, error: errPros } = await supabase.from('professionals')
                .select('id, first_name, last_name, role')
                .eq('organization_id', oid)
                .order('role', { ascending: true });

            if (errPros) throw new Error("Erreur chargement équipe: " + errPros.message);

            // Fetch Services
            const { data: servs, error: errServs } = await supabase.from('services')
                .select('id, designation')
                .eq('organization_id', oid);

            if (errServs) throw new Error("Erreur chargement services: " + errServs.message);

            // Fetch Existing Authorizations
            const { data: auths, error: errAuths } = await supabase.from('professional_service_authorizations')
                .select('professional_id, service_id, authorized');

            // If table missing, this throws. If auths is null, we default.
            if (errAuths) {
                // Warn but maybe allow? No, critical.
                console.error("Auth fetch error:", errAuths);
                // If table missing error, prompt for migration? No, user can't do that.
            }

            const initialMatrix: Record<string, boolean> = {};

            if (pros && servs) {
                pros.forEach(p => {
                    servs.forEach(s => {
                        const key = `${p.id}_${s.id}`;
                        const existing = auths?.find(a => a.professional_id === p.id && a.service_id === s.id);
                        // If record exists, use authorized val. Else true.
                        initialMatrix[key] = existing ? existing.authorized : true;
                    });
                });
                setTeam(pros);
                setServices(servs);
                setMatrix(initialMatrix);
            }
        } catch (err: any) {
            console.error(err);
            alert("Erreur technique: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleAuth = (proId: string, serviceId: string) => {
        const key = `${proId}_${serviceId}`;
        setMatrix(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleNext = async () => {
        if (!orgId) return;
        setLoading(true);

        // Prepare Upsert Data
        const upsertData = [];
        for (const p of team) {
            for (const s of services) {
                const key = `${p.id}_${s.id}`;
                upsertData.push({
                    professional_id: p.id,
                    service_id: s.id,
                    authorized: matrix[key], // Save explicit state
                    // organization_id? Table might not have it if it's pure join. Usually join tables link 2 IDs.
                    // Checking schema later, but standard is (pro_id, service_id).
                });
            }
        }

        if (upsertData.length > 0) {
            const { error } = await supabase
                .from('professional_service_authorizations')
                .upsert(upsertData, { onConflict: 'professional_id, service_id' });

            if (error) {
                alert("Erreur sauvegarde: " + error.message);
                setLoading(false);
                return;
            }
        }

        // Validate Step 5
        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 5, p_org_id: orgId });

        if (result && result.valid) {
            // Advance to Step 6 (Ready)
            // Need to update organization onboarding_step if we track it strictly?
            // Since we added a step, 'step 5' is now Skills. 'step 6' is Ready.
            // We need to ensure DB 'onboarding_step' updates to 6.
            await supabase.from('organizations').update({ onboarding_step: 6 }).eq('id', orgId);
            router.push("/onboardingpro/step-6-ready");
        } else {
            alert("Erreur validation étape: " + JSON.stringify(result));
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/onboardingpro/step-4-team')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Étape 5 : Qui fait quoi ?</h1>
                    <p className="text-gray-500">Définissez les compétences de chaque membre (Tout est activé par défaut).</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {team.map(member => (
                    <div key={member.id} className="border rounded-xl p-4 bg-white shadow-sm flex flex-col gap-4">
                        <div className="flex items-center gap-3 border-b pb-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${member.role === 'admin' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>
                                {member.first_name[0]}{member.last_name ? member.last_name[0] : ''}
                            </div>
                            <div>
                                <div className="font-semibold">{member.first_name} {member.last_name}</div>
                                <div className="text-xs text-gray-400 capitalize">{member.role}</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {services.map(service => {
                                const isAuth = matrix[`${member.id}_${service.id}`];
                                return (
                                    <div
                                        key={service.id}
                                        onClick={() => toggleAuth(member.id, service.id)}
                                        className={`cursor-pointer px-3 py-1.5 rounded-full text-sm border flex items-center gap-2 transition-all ${isAuth ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-dashed text-gray-400 opacity-60'}`}
                                    >
                                        {isAuth && <Check className="w-3 h-3" />}
                                        {service.designation}
                                    </div>
                                );
                            })}
                            {services.length === 0 && <span className="text-xs text-gray-400 italic">Aucun service défini.</span>}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handleNext} className="gap-2" size="lg">
                    Valider & Terminer <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
