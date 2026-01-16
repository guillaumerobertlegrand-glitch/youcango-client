"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, User, Users, Check, Smartphone, Trash2 } from "lucide-react";
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

    const [inviteFirstName, setInviteFirstName] = useState("");
    const [inviteLastName, setInviteLastName] = useState("");

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
        // Fetch Pros and joined Emails if possible (auth users table not accessible directly usually, so rely on pro table fields or generic joins)
        // Here assuming pro table has basic info.
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
                status: 'inactive' // Fixed from unused
            }).select().single();
            if (newDev) deviceId = newDev.id;
        }

        // 3. Assign
        const myProId = team.find(p => p.user_id === userId)?.id;
        if (myProId && deviceId) {
            await supabase.rpc('api_v1_assign_device_to_pro', { p_pro_id: myProId, p_device_id: deviceId });

            // Auto-authorize all services for Admin (Solo Mode)
            const { data: services } = await supabase.from('services').select('id').eq('organization_id', orgId);
            if (services && services.length > 0) {
                const auths = services.map(s => ({
                    professional_id: myProId,
                    service_id: s.id,
                    authorized: true,
                    priority: 1,
                    skill_level: 'expert'
                }));
                // Use upsert to avoid duplicates if re-running
                await supabase.from('professional_service_authorizations').upsert(auths, { onConflict: 'professional_id, service_id' });
            }
        }

        proceedNext();
    };

    const sendInvite = async () => {
        if (!orgId) return;
        setLoading(true);
        // Note: The API route needs to better handle first/last name
        const res = await fetch('/api/invite-editor', {
            method: 'POST',
            body: JSON.stringify({
                email: inviteEmail,
                organization_id: orgId,
                role: inviteRole,
                first_name: inviteFirstName,
                last_name: inviteLastName
            })
        });
        const json = await res.json();
        setLoading(false);
        if (json.success) {
            setInviteEmail("");
            setInviteFirstName("");
            setInviteLastName("");
            fetchData(orgId);
        } else {
            alert(json.error);
        }
    };

    const linkDevice = async (proId: string, devId: string) => {
        await supabase.rpc('api_v1_assign_device_to_pro', { p_pro_id: proId, p_device_id: devId });
        if (orgId) fetchData(orgId);
    };

    const removeMember = async (proId: string) => {
        if (!confirm("Voulez-vous vraiment retirer ce membre de l'équipe ?")) return;
        setLoading(true);
        const { data, error } = await supabase.rpc('api_v1_remove_team_member', { p_pro_id: proId, p_org_id: orgId });
        if (error || !data.success) {
            alert("Erreur: " + (error?.message || data?.error));
            setLoading(false);
        } else {
            fetchData(orgId!);
        }
    };

    const proceedNext = async () => {
        if (!orgId) return;

        // TEAM VALIDATION RULE
        if (mode === 'team' && team.length < 2) {
            alert("En mode Équipe, vous devez inviter au moins un collaborateur. Sinon, passez en mode Solo.");
            return;
        }

        // DEVICE ASSIGNMENT RULE (Strict)
        const unequipped = team.filter(member => !devices.some(d => d.pro_id === member.id && d.status === 'active'));
        if (unequipped.length > 0) {
            alert(`Attention : Certains membres n'ont pas de terminal assigné (${unequipped.map(m => m.first_name).join(', ')}).\n\nVeuillez leur assigner une caisse/tablette ou les retirer de l'équipe.`);
            return;
        }

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
    const isAdmin = myPro?.role === 'admin';

    // Filter controls for non-admins
    const canManage = isAdmin;

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
                    onClick={() => canManage && setMode('solo')}
                    className={`cursor-pointer p-4 rounded-lg flex flex-col items-center border-2 w-40 transition-all ${mode === 'solo' ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:bg-white'} ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <User className={`w-8 h-8 mb-2 ${mode === 'solo' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className="font-semibold">Solo</span>
                    <span className="text-xs text-center text-gray-500">Je travaille seul</span>
                </div>
                <div
                    onClick={() => canManage && setMode('team')}
                    className={`cursor-pointer p-4 rounded-lg flex flex-col items-center border-2 w-40 transition-all ${mode === 'team' ? 'border-purple-600 bg-purple-50' : 'border-transparent hover:bg-white'} ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
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

                    {/* Invite Form (Admins Only) */}
                    {isAdmin && (
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input className="border p-2 rounded flex-1" placeholder="Prénom" value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} />
                                <input className="border p-2 rounded flex-1" placeholder="Nom" value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                                <input className="border p-2 rounded flex-grow" placeholder="Email Collaborateur" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                                <select className="border p-2 rounded bg-white w-32" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                                    <option value="admin">Admin</option>
                                    <option value="editor">Editor</option>
                                    <option value="user">User</option>
                                </select>
                                <Button onClick={sendInvite} size="sm" disabled={!inviteEmail || !inviteFirstName || !inviteLastName}>Inviter</Button>
                            </div>
                        </div>
                    )}

                    {/* Team List */}
                    <div className="space-y-4">
                        {team
                            // Sort: Me first, then Admin, then others
                            .sort((a, b) => {
                                if (a.user_id === userId) return -1;
                                if (b.user_id === userId) return 1;
                                return (b.role === 'admin' ? 1 : 0) - (a.role === 'admin' ? 1 : 0);
                            })
                            .map((member, index) => (
                                <div key={member.id} className="p-4 border rounded bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center relative">
                                    {member.user_id === userId && (
                                        <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-br font-bold">MOI ({member.role?.toUpperCase()})</div>
                                    )}

                                    <div>
                                        <p className="font-medium mt-1">{member.first_name} {member.last_name || ''}
                                            {member.job_title && <span className="text-gray-500 text-sm font-normal"> - {member.job_title}</span>}
                                        </p>
                                        <p className="text-gray-400 text-xs">{member.email || 'Email non renseigné'}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">{member.role}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                                                {member.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Device Selector */}
                                        <div className="flex items-center gap-2">
                                            <Smartphone className={`w-4 h-4 ${devices.some(d => d.pro_id === member.id) ? 'text-green-600' : 'text-red-400'}`} />
                                            <select
                                                className={`text-sm border rounded p-1 max-w-[150px] ${!devices.some(d => d.pro_id === member.id) ? 'border-red-300 bg-red-50' : ''}`}
                                                value={devices.find(d => d.pro_id === member.id)?.id || ""}
                                                onChange={(e) => linkDevice(member.id, e.target.value)}
                                                disabled={!isAdmin}
                                            >
                                                <option value="">Aucun Terminal</option>
                                                {devices.map(d => (
                                                    <option key={d.id} value={d.id} disabled={d.status === 'active' && d.pro_id !== member.id}>
                                                        {d.name} {d.status === 'active' && d.pro_id !== member.id ? '(Occupé)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Remove Button (Only for Admins, removing others) */}
                                        {isAdmin && member.user_id !== userId && (
                                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-600" onClick={() => removeMember(member.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <Button onClick={mode === 'solo' ? handleSoloSetup : proceedNext} className="w-full" disabled={!isAdmin && team.some(m => !devices.some(d => d.pro_id === m.id))}>
                    {mode === 'solo' ? "Configurer & Terminer" : "Valider & Suivant"}
                </Button>

                {!isAdmin && team.some(m => !devices.some(d => d.pro_id === m.id)) && (
                    <p className="text-center text-red-500 text-sm">
                        En attente de l'administrateur : Certains membres n'ont pas de terminal.
                        <br />Veuillez contacter l'admin pour finaliser la configuration.
                    </p>
                )}
            </div>
        </div>
    );
}
