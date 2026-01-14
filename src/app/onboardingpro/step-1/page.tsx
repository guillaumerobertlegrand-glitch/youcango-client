"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step1Page() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);

    // Form Data States
    const [siret, setSiret] = useState("");
    const [officialName, setOfficialName] = useState("");
    const [apeCode, setApeCode] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("editor");
    const [team, setTeam] = useState<any[]>([]);

    // Initialize State & Guard
    useEffect(() => {
        async function init() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.push("/login");

                const { data: pro } = await supabase
                    .from('professionals')
                    .select('id, role, organization_id, organization:organizations(onboarding_step, siret, official_name, ape_code)')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (pro) {
                    setRole(pro.role);
                    setOrgId(pro.organization_id);
                    // @ts-ignore
                    const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;
                    if (org) {
                        setSiret(org.siret || "");
                        setOfficialName(org.official_name || "");
                        setApeCode(org.ape_code || "");
                    }

                    // Pre-fetch Team
                    const { data: teamMembers } = await supabase
                        .from('professionals')
                        .select('id, first_name, last_name, email, role, status')
                        .eq('organization_id', pro.organization_id);
                    setTeam(teamMembers || []);

                } else {
                    // No Org -> Redirect to Dispatcher
                    router.push("/onboardingpro");
                }
            } catch (e) {
                console.error("Init Error:", e);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [supabase, router]);


    // Actions
    const saveIdentity = async () => {
        if (!orgId) return;
        const { error } = await supabase.from('organizations').update({
            siret,
            official_name: officialName,
            ape_code: apeCode
        }).eq('id', orgId);

        if (error) alert("Erreur de sauvegarde : " + error.message);
        else alert("Identité sauvegardée avec succès !");
    };

    const sendInvite = async () => {
        if (!orgId) return;
        const res = await fetch('/api/invite-editor', {
            method: 'POST',
            body: JSON.stringify({
                email: inviteEmail,
                organization_id: orgId,
                role: inviteRole
            })
        });
        const json = await res.json();
        alert(json.message || json.error);

        if (json.success) {
            const { data: teamMembers } = await supabase.from('professionals').select('*').eq('organization_id', orgId);
            setTeam(teamMembers || []);
            setInviteEmail("");
        }
    };

    const mockStripe = async () => {
        if (!orgId) return;
        const { error } = await supabase.rpc('api_v1_mock_stripe_link', { p_org_id: orgId });
        if (error) alert("Erreur Stripe: " + error.message);
        else alert("Stripe connecté (Simulation) !");
    };

    const handleNext = async () => {
        if (!orgId) return;
        setLoading(true);

        try {
            const { data: result, error } = await supabase.rpc('api_v1_validate_onboarding_step', {
                p_step: 1,
                p_org_id: orgId
            });

            if (error) throw error;

            if (result.valid) {
                await supabase.from('organizations').update({ onboarding_step: 2 }).eq('id', orgId);
                router.push("/onboardingpro/step-2");
            } else {
                const checks = result.details?.checks || result.details || {};
                const failures = Object.entries(checks)
                    // @ts-ignore
                    .filter(([key, val]) => val === false)
                    .map(([key]) => key.replace('has_', '').replace('_', ' '));

                alert(`Validation incomplète : ${failures.join(", ") || "Vérifiez les critères requis."}`);
            }

        } catch (e: any) {
            alert("Erreur : " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">Étape 1 : Identité & Équipe</h1>

            <div className="space-y-4 border p-4 rounded bg-white shadow-sm">
                <h2 className="font-semibold">Informations Légales</h2>
                <div className="grid gap-2">
                    <input className="border p-2 rounded" placeholder="SIRET" value={siret} onChange={e => setSiret(e.target.value)} />
                    <input className="border p-2 rounded" placeholder="Raison Sociale" value={officialName} onChange={e => setOfficialName(e.target.value)} />
                    <input className="border p-2 rounded" placeholder="Code APE" value={apeCode} onChange={e => setApeCode(e.target.value)} />
                    <Button onClick={saveIdentity} size="sm" variant="outline">Sauvegarder Identité</Button>
                </div>

                {role === 'admin' ? (
                    <div className="mt-8 border-t pt-6">
                        <h3 className="font-semibold text-lg mb-4">Gestion d'Équipe & Finance</h3>

                        <div className="bg-slate-50 p-4 rounded border mb-6">
                            <h4 className="text-sm font-medium mb-2">Connexion Bancaire (Stripe)</h4>
                            <Button onClick={mockStripe} size="sm" variant="secondary" className="w-full">Simuler Connexion Stripe</Button>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium mb-2">Membres ({team.length})</h4>
                            <p className="text-xs text-gray-500 mb-2">Minimum 2 membres requis.</p>

                            <ul className="space-y-2 mb-4">
                                {team.map((member) => (
                                    <li key={member.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm border-b">
                                        <span>{member.first_name || 'Invité'} {member.last_name || ''} <span className="text-gray-400 text-xs">({member.email})</span></span>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{member.role}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {member.status}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="flex gap-2">
                                <input className="border p-2 rounded flex-grow" placeholder="Email Collaborateur" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                                <select className="border p-2 rounded bg-white" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                                    <option value="admin">Admin</option>
                                    <option value="editor">Editor</option>
                                    <option value="user">User</option>
                                </select>
                                <Button onClick={sendInvite} size="sm">Inviter</Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-yellow-600 mt-2">Section Admin masquée.</p>
                )}
            </div>

            <Button
                onClick={handleNext}
                className="w-full"
                disabled={team.length < 2}
            >
                {team.length < 2 ? "Invitez un membre pour continuer" : "Valider & Suivant"}
            </Button>
        </div>
    );
}
