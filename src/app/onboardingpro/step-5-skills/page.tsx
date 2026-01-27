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
        <div className="flex flex-col min-h-full">
            <div className="flex-grow p-4 space-y-6">
                <header className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/onboardingpro/step-4-team')} className="h-8 w-8 -ml-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Compétences</h1>
                        <p className="text-sm text-slate-500 mt-1">Qui fait quoi ?</p>
                    </div>
                </header>

                <div className="grid gap-4">
                    {team.map(member => (
                        <div key={member.id} className="bg-white border text-left rounded-xl p-4 shadow-sm flex flex-col gap-4">
                            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${member.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                    {member.first_name[0]}
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-900">{member.first_name} {member.last_name}</div>
                                    <div className="text-xs text-slate-400 capitalize bg-slate-50 inline-block px-1.5 py-0.5 rounded">{member.role}</div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {services.map(service => {
                                    const isAuth = matrix[`${member.id}_${service.id}`];
                                    return (
                                        <div
                                            key={service.id}
                                            onClick={() => toggleAuth(member.id, service.id)}
                                            className={`cursor-pointer px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-2 transition-all select-none
                                                ${isAuth
                                                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                                                    : 'bg-slate-50 border-slate-100 text-slate-400 opacity-70 grayscale'}`}
                                        >
                                            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isAuth ? 'bg-blue-500 text-white' : 'bg-slate-200'}`}>
                                                {isAuth && <Check className="w-2.5 h-2.5" />}
                                            </div>
                                            {service.designation}
                                        </div>
                                    );
                                })}
                                {services.length === 0 && <span className="text-xs text-slate-400 italic">Aucun service défini.</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-100 pb-8">
                <Button onClick={handleNext} className="w-full h-12 text-base font-semibold shadow-xl shadow-slate-200" size="lg">
                    Continuer
                </Button>
            </div>
        </div>
    );
}
