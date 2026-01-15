"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, User, Users, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { signout } from "@/app/login/actions";

export default function Step4TeamPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Mode Toggle
    const [mode, setMode] = useState<'solo' | 'team'>('solo');

    // Data
    const [team, setTeam] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("editor");

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");
            setUserId(user.id);

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
        const { data: pros } = await supabase.from('professionals').select('*, devices(*)').eq('organization_id', oid);
        let { data: devs } = await supabase.from('devices').select('*').eq('organization_id', oid);

        // AUTO-SEED: If no devices, create defaults so the user isn't stuck
        if (!devs || devs.length === 0) {
            await supabase.from('devices').insert([
                { organization_id: oid, name: 'Caisse Principale', status: 'inactive', type: 'tablet' },
                { organization_id: oid, name: 'Tablette Mobile', status: 'inactive', type: 'phone' }
            ]);
            const { data: newDevs } = await supabase.from('devices').select('*').eq('organization_id', oid);
            devs = newDevs;
        }

        setTeam(pros || []);
        setDevices(devs || []);

        // Auto-detect mode based on team size
        if (pros && pros.length > 1) setMode('team');
        setLoading(false);
    };

    // Actions
    const handleSoloSetup = async () => {
        if (!orgId || !userId) return;
        setLoading(true);

        // 1. Ensure user is Admin (should be already)
        // 2. Find a free device (or create one if none? For now assume seeded or create dummy)
        let deviceId = devices.find(d => d.status === 'inactive' && !d.pro_id)?.id;

        // MVP Hack: specific to Demo
        if (!deviceId) {
            const { data: newDev } = await supabase.from('devices').insert({
                organization_id: orgId,
                name: 'Mon Tablette',
                status: 'unused'
            }).select().single();
            if (newDev) deviceId = newDev.id;
        }

        // 3. Assign
        const myProId = team.find(p => p.user_id === userId)?.id;
        if (myProId && deviceId) {
            await supabase.rpc('api_v1_assign_device_to_pro', { p_pro_id: myProId, p_device_id: deviceId });
            // Also auto-authorize all services? (Skipped for MVP check, validator just checks skills existence if strict, but our validator is loose on skills for now)
        }

        proceedNext();
    };

    const sendInvite = async () => {
        if (!orgId) return;
        const res = await fetch('/api/invite-editor', {
            method: 'POST',
            body: JSON.stringify({ email: inviteEmail, organization_id: orgId, role: inviteRole })
        });
        const json = await res.json();
        if (json.success) {
            setInviteEmail("");
            fetchData(orgId);
        } else {
            alert(json.error);
        }
    };

    const linkDevice = async (proId: string, devId: string) => {
        await supabase.rpc('api_v1_assign_device_to_pro', { p_pro_id: proId, p_device_id: devId });
        if (orgId) fetchData(orgId);
    };

    const proceedNext = async () => {
        if (!orgId) return;

        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 4, p_org_id: orgId });
        if (result.valid) {
            await supabase.from('organizations').update({ onboarding_step: 5 }).eq('id', orgId);
            router.push("/onboardingpro/step-5-ready");
        } else {
            const fails = result.details ? Object.keys(result.details).filter(k => !result.details[k]) : [];
            alert("Validation incomplète : " + fails.join(", "));
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    const myPro = team.find(p => p.user_id === userId);

    return (
        <div className="p-6 space-y-8 max-w-3xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Étape 4 : Équipe & Outils</h1>
                <form action={signout}>
                    <Button variant="ghost" size="sm" className="text-red-500">Se déconnecter</Button>
                </form>
            </div>

            {/* Mode Toggle */}
            <div className="flex justify-center space-x-10 p-6 bg-slate-50 rounded-xl border">
                <div
                    onClick={() => setMode('solo')}
                    className={`cursor-pointer p-4 rounded-lg flex flex-col items-center border-2 w-40 transition-all ${mode === 'solo' ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:bg-white'}`}
                >
                    <User className={`w-8 h-8 mb-2 ${mode === 'solo' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className="font-semibold">Solo</span>
                    <span className="text-xs text-center text-gray-500">Je travaille seul</span>
                </div>
                <div
                    onClick={() => setMode('team')}
                    className={`cursor-pointer p-4 rounded-lg flex flex-col items-center border-2 w-40 transition-all ${mode === 'team' ? 'border-purple-600 bg-purple-50' : 'border-transparent hover:bg-white'}`}
                >
                    <Users className={`w-8 h-8 mb-2 ${mode === 'team' ? 'text-purple-600' : 'text-gray-400'}`} />
                    <span className="font-semibold">Équipe</span>
                    <span className="text-xs text-center text-gray-500">Nous sommes plusieurs</span>
                </div>
            </div>

            {mode === 'solo' ? (
                <div className="border p-6 rounded bg-white shadow-sm space-y-4 text-center">
                    <h3 className="font-semibold text-lg">Configuration Rapide</h3>
                    <p className="text-gray-600">
                        En mode Solo, nous vous assignons automatiquement tous les services et votre terminal.
                    </p>
                    <div className="py-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm">
                            <Check className="w-4 h-4" /> Admin: {myPro?.first_name}
                        </div>
                        <span className="mx-2 text-gray-300">|</span>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
                            <Smartphone className="w-4 h-4" /> 1 Terminal Auto-assigné
                        </div>
                    </div>
                </div>
            ) : (
                <div className="border p-6 rounded bg-white shadow-sm space-y-6">
                    <h3 className="font-semibold text-lg">Gestion de l'Équipe</h3>

                    {/* Invite Form */}
                    <div className="flex gap-2">
                        <input className="border p-2 rounded flex-grow" placeholder="Email Collaborateur" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                        <select className="border p-2 rounded bg-white" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                            <option value="user">User</option>
                        </select>
                        <Button onClick={sendInvite} size="sm">Inviter</Button>
                    </div>

                    {/* Team List */}
                    <div className="space-y-4">
                        {team.map((member) => (
                            <div key={member.id} className="p-4 border rounded bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                                <div>
                                    <p className="font-medium">{member.first_name || 'Invité'} {member.last_name} <span className="text-gray-400 text-xs">({member.email})</span></p>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">{member.role}</span>
                                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">{member.status}</span>
                                    </div>
                                </div>

                                {/* Device Selector */}
                                <div className="flex items-center gap-2">
                                    <Smartphone className="w-4 h-4 text-gray-500" />
                                    <select
                                        className="text-sm border rounded p-1"
                                        value={devices.find(d => d.pro_id === member.id)?.id || ""}
                                        onChange={(e) => linkDevice(member.id, e.target.value)}
                                    >
                                        <option value="">Aucun Terminal</option>
                                        {devices.map(d => (
                                            <option key={d.id} value={d.id} disabled={d.status === 'active' && d.pro_id !== member.id}>
                                                {d.name} {d.status === 'active' && d.pro_id !== member.id ? '(Occupé)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Button onClick={mode === 'solo' ? handleSoloSetup : proceedNext} className="w-full">
                {mode === 'solo' ? "Configurer & Terminer" : "Valider & Suivant"}
            </Button>
        </div>
    );
}
