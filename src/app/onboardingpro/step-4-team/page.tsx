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
    const [deviceTypes, setDeviceTypes] = useState<any[]>([]);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("editor");
    const [inviteFirstName, setInviteFirstName] = useState("");
    const [inviteLastName, setInviteLastName] = useState("");

    // Device Form
    const [newDeviceName, setNewDeviceName] = useState("");
    const [newDeviceTypeId, setNewDeviceTypeId] = useState("");
    const [soloDeviceTypeId, setSoloDeviceTypeId] = useState("");

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");
            setUserId(user.id);

            const { data: pro } = await supabase.from('professionals').select('organization_id').eq('user_id', user.id).maybeSingle();
            if (pro) {
                setOrgId(pro.organization_id);
                // Fetch Types FIRST
                const { data: types } = await supabase.from('config_device_types').select('*').eq('is_active_mvp', true);
                setDeviceTypes(types || []);
                fetchData(pro.organization_id);
            } else {
                router.push("/onboardingpro");
            }
        }
        init();
    }, [router, supabase]);

    const fetchData = async (oid: string) => {
        const { data: pros } = await supabase.from('professionals').select('*, devices(*)').eq('organization_id', oid);
        // We still fetch devices to know current assignments
        let { data: devs } = await supabase.from('devices').select('*, config_device_types(label)').eq('organization_id', oid);

        setTeam(pros || []);
        setDevices(devs || []);

        // Auto-detect mode based on team size
        if (pros && pros.length > 1) setMode('team');
        setLoading(false);
    };

    // Actions
    const assignDeviceType = async (proId: string, typeId: string) => {
        if (!orgId) return;
        // Optimistic UI update could be added here, but for now wait for server
        // If typeId is empty, we might want to "unassign"? The RPC/UI implies selection.
        if (!typeId) return;

        const { data, error } = await supabase.rpc('api_v1_assign_device_type', {
            p_pro_id: proId,
            p_type_id: typeId,
            p_org_id: orgId
        });

        if (error || !data.success) {
            alert("Erreur assignation: " + (error?.message || data?.error));
        } else {
            fetchData(orgId);
        }
    };

    const handleSoloSetup = async () => {
        if (!orgId || !userId) return;

        if (!soloDeviceTypeId) {
            alert("Veuillez sélectionner votre type de terminal (Smartphone ou Tablette) pour continuer.");
            return;
        }

        setLoading(true);

        const myProId = team.find(p => p.user_id === userId)?.id;

        if (myProId) {
            // Assign Selected Device
            await supabase.rpc('api_v1_assign_device_type', { p_pro_id: myProId, p_type_id: soloDeviceTypeId, p_org_id: orgId });

            // Auths (Service Permissions)
            const { data: services } = await supabase.from('services').select('id').eq('organization_id', orgId);
            if (services && services.length > 0) {
                const auths = services.map(s => ({ professional_id: myProId, service_id: s.id, authorized: true, priority: 1, skill_level: 'expert' }));
                await supabase.from('professional_service_authorizations').upsert(auths, { onConflict: 'professional_id, service_id' });
            }
        }

        // Refresh data to verify assignment before proceeding (crucial for validation check)
        await fetchData(orgId);

        // Wait a bit or verify directly?
        // Proceed Next will check 'devices'. fetchData updates 'devices'.
        // BUT fetchData is async. 'await fetchData' finishes updating state?
        // No, React state updates are async. calling proceedNext immediately uses OLD 'devices' state.

        // WORKAROUND: We need to trigger proceedNext AFTER state update or bypass local check if we trust RPC.
        // Better: We reload page or we pass a flag to proceedNext?
        // Or simpler: We make proceedNext check DB? No, it uses 'devices' state.

        // Hack: Check assignment manually or rely on effect?
        // I will make proceedNext check validity via RPC call directly if local check fails?
        // Or better: Just verify by re-fetching and then calling proceed...
        // Actually, proceedNext uses 'devices' state variable.
        // We can't wait for state update in same function easily.
        // I will move proceedNext call to a useEffect or just assume it works and manually update the local 'devices' array for the check?
        // Let's manually update 'devices' local state for the check to pass immediately.

        // Actually, simpler: Recalling fetchData updates state.
        // I will just use `setTimeout` hack or just return and let user click "Valider" again?
        // User wants "Configurer & Terminer". It should be one click.

        // I'll update the proceedNext logic to allow passing fresh data OR just run the validation RPC directly without local check if mode==solo?
        // No, local check provides better feedback.

        const { data: freshDevs } = await supabase.from('devices').select('*').eq('organization_id', orgId);
        setDevices(freshDevs || []);
        // Even if I setDevices, 'devices' const in scope is old.

        // I'll call the validation RPC directly here to decide.
        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 4, p_org_id: orgId });
        if (result.valid) {
            await supabase.from('organizations').update({ onboarding_step: 5 }).eq('id', orgId);
            router.push("/onboardingpro/step-5-ready");
            return;
        } else {
            // If invalid (likely timing), just alert?
            // Actually, if we just awaited assign_device_type, it SHOULD be valid immediately.
            alert("Configuration appliquée. Veuillez cliquer une seconde fois pour valider.");
            setLoading(false);
        }
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
        // Check if every active pro has a device assigned (which means it's in the devices list)
        // Since we auto-create devices, checking if a device exists for the pro is enough.
        const unequipped = team.filter(member => !devices.some(d => d.pro_id === member.id && d.status === 'active'));
        if (unequipped.length > 0) {
            alert(`Attention : Certains membres n'ont pas de terminal assigné (${unequipped.map(m => m.first_name).join(', ')}).\n\nVeuillez sélectionner un type d'appareil pour chacun.`);
            return;
        }

        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 4, p_org_id: orgId });
        if (result.valid) {
            await supabase.from('organizations').update({ onboarding_step: 5 }).eq('id', orgId);
            router.push("/onboardingpro/step-5-ready");
        } else {
            alert("Validation incomplète : " + JSON.stringify(result.details));
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
                        En mode Solo, nous vous assignons automatiquement tous les services.<br />
                        Veuillez choisir votre outil de travail :
                    </p>

                    <div className="max-w-xs mx-auto my-4">
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">Mon Terminal</label>
                        <select
                            className="block w-full border p-2 rounded bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            value={soloDeviceTypeId}
                            onChange={(e) => setSoloDeviceTypeId(e.target.value)}
                        >
                            <option value="">Sélectionner...</option>
                            {deviceTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="py-2">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm">
                            <Check className="w-4 h-4" /> Admin: {myPro?.first_name}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="border p-6 rounded bg-white shadow-sm space-y-6">
                    <h3 className="font-semibold text-lg">Gestion de l'Équipe</h3>

                    {/* Invite Form (Admins Only) */}
                    {isAdmin && (
                        <div className="flex flex-col gap-2 mb-6">
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

                    {/* Team List with DIRECT DEVICE ASSIGNMENT */}
                    <div className="space-y-4">
                        {team
                            // Sort: Me first, then Admin, then others
                            .sort((a, b) => {
                                if (a.user_id === userId) return -1;
                                if (b.user_id === userId) return 1;
                                return (b.role === 'admin' ? 1 : 0) - (a.role === 'admin' ? 1 : 0);
                            })
                            .map((member, index) => {
                                // Find device assigned to this pro
                                const assignedDevice = devices.find(d => d.pro_id === member.id);
                                const currentTypeId = assignedDevice?.device_type_id || "";

                                return (
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
                                            {/* Direct Device Type Selector */}
                                            <div className="flex items-center gap-2">
                                                <Smartphone className={`w-4 h-4 ${assignedDevice ? 'text-green-600' : 'text-red-400'}`} />
                                                <select
                                                    className={`text-sm border rounded p-1 w-40 ${!assignedDevice ? 'border-red-300 bg-red-50' : ''}`}
                                                    value={currentTypeId}
                                                    onChange={(e) => assignDeviceType(member.id, e.target.value)}
                                                    disabled={!isAdmin}
                                                >
                                                    <option value="">Choisir un terminal...</option>
                                                    {deviceTypes.map(t => (
                                                        <option key={t.id} value={t.id}>{t.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Remove Button */}
                                            {isAdmin && member.user_id !== userId && (
                                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-600" onClick={() => removeMember(member.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
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
