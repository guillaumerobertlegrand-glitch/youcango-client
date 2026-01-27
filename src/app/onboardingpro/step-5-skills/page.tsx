"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IOSSection, IOSRow } from "@/components/ui/ios-settings";
import { cn } from "@/lib/utils";

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

            if (errAuths) {
                console.error("Auth fetch error:", errAuths);
            }

            const initialMatrix: Record<string, boolean> = {};

            if (pros && servs) {
                pros.forEach(p => {
                    servs.forEach(s => {
                        const key = `${p.id}_${s.id}`;
                        const existing = auths?.find(a => a.professional_id === p.id && a.service_id === s.id);
                        // If record exists, use authorized val. Else true (default to enabled).
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
            await supabase.from('organizations').update({ onboarding_step: 6 }).eq('id', orgId);
            router.push("/onboardingpro/step-6-ready");
        } else {
            alert("Erreur validation étape: " + JSON.stringify(result));
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-500" /></div>;

    return (
        <div className="h-full font-sans bg-[#F2F2F7] relative overflow-hidden flex flex-col">

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-6">

                {/* Header */}
                <header className="mt-10 px-6 mb-2">
                    <h1 className="text-[22px] font-bold text-black tracking-tight">
                        Compétences
                    </h1>
                    <p className="text-[17px] text-[#000000] mt-2 leading-relaxed">
                        Qui fait quoi ?
                    </p>
                </header>

                {/* Member Sections */}
                {team.map(member => (
                    <IOSSection
                        key={member.id}
                        title={`${member.first_name} ${member.last_name} (${member.role === 'admin' ? 'Admin' : 'Membre'})`}
                    >
                        {services.length > 0 ? (
                            services.map((service, idx) => {
                                const isAuth = matrix[`${member.id}_${service.id}`];
                                return (
                                    <IOSRow
                                        key={service.id}
                                        label={service.designation}
                                        separator={idx !== services.length - 1}
                                        onClick={() => toggleAuth(member.id, service.id)}
                                    >
                                        {isAuth && <Check className="w-5 h-5 text-[#007AFF]" />}
                                    </IOSRow>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-gray-500 text-[15px]">
                                Aucun service disponible.
                            </div>
                        )}
                    </IOSSection>
                ))}

            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 z-10 relative mt-auto pb-6 pt-2 bg-[#F2F2F7]/80 backdrop-blur-md border-t border-[#C6C6C8]/30">
                <div className="px-4">
                    <Button
                        onClick={handleNext}
                        className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-bold text-[17px] h-12 rounded-[16px]"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : "Continuer"}
                    </Button>
                </div>
            </div>

        </div>
    );
}
