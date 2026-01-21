"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, User, Users, Check, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";


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
        // For Solo: We skip Step 5 (Skills) visually, but we must ensure it passes validation.
        // Since we upserted authorizations above, S5 validation (check if auths exist) should pass.

        // Check Step 4 first
        const { data: v4 } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 4, p_org_id: orgId });
        // Check Step 5 (implicit for Solo)
        const { data: v5 } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 5, p_org_id: orgId });

        if (v4.valid && v5.valid) {
            // Updated to Step 6 (Ready)
            await supabase.from('organizations').update({ onboarding_step: 6 }).eq('id', orgId);
            router.push("/onboardingpro/step-6-ready");
            return;
        } else {
            const errorMsg = [];
            if (!v4.valid) errorMsg.push("Etape 4: " + (v4.error || "Invalide"));
            if (!v5.valid) errorMsg.push("Etape 5: " + (v5.error || "Invalide"));

            alert("Configuration incomplète :\n" + errorMsg.join("\n"));
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
            // Team Mode -> Go to Step 5 (Skills)
            await supabase.from('organizations').update({ onboarding_step: 5 }).eq('id', orgId);
            router.push("/onboardingpro/step-5-skills");
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
        <div className="flex flex-col min-h-full">
            <div className="flex-grow p-4 space-y-6">
                <header className="flex justify-between items-start">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Équipe & Outils</h1>
                        <p className="text-sm text-slate-500 mt-1">Qui utilisera YouCanGo ?</p>
                    </div>
                </header>

                {/* Mode Toggle */}
                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
                    <div
                        onClick={() => canManage && setMode('solo')}
                        className={`cursor-pointer py-3 rounded-lg flex flex-col items-center justify-center transition-all ${mode === 'solo' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                    >
                        <User className="w-5 h-5 mb-1" />
                        <span className="text-xs font-semibold">Solo</span>
                    </div>
                    <div
                        onClick={() => canManage && setMode('team')}
                        className={`cursor-pointer py-3 rounded-lg flex flex-col items-center justify-center transition-all ${mode === 'team' ? 'bg-white shadow text-purple-600' : 'text-slate-400'}`}
                    >
                        <Users className="w-5 h-5 mb-1" />
                        <span className="text-xs font-semibold">Équipe</span>
                    </div>
                </div>

                {mode === 'solo' ? (
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4 text-center">
                        <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                            <Smartphone className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-slate-900">Mode Solo</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Vous êtes le seul utilisateur. Tout sera configué pour vous automatiquement.
                        </p>

                        <div className="pt-4 text-left space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Mon Terminal</label>
                            <select
                                className="w-full border p-3 rounded-lg bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                                value={soloDeviceTypeId}
                                onChange={(e) => setSoloDeviceTypeId(e.target.value)}
                            >
                                <option value="">Sélectionner...</option>
                                {deviceTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Invite Form (Admins Only) */}
                        {isAdmin && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <h3 className="text-sm font-semibold mb-3">Inviter un membre</h3>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input className="border p-2 rounded-lg text-sm w-1/2" placeholder="Prénom" value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} />
                                        <input className="border p-2 rounded-lg text-sm w-1/2" placeholder="Nom" value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} />
                                    </div>
                                    <input className="border p-2 rounded-lg text-sm w-full" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                                    <div className="flex gap-2">
                                        <select className="border p-2 rounded-lg text-sm flex-grow bg-white" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                                            <option value="admin">Admin</option>
                                            <option value="editor">Editor</option>
                                            <option value="user">User</option>
                                        </select>
                                        <Button onClick={sendInvite} size="sm" className="px-4" disabled={!inviteEmail || !inviteFirstName}>Inviter</Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Team List */}
                        <div className="space-y-3">
                            {team
                                .sort((a, b) => {
                                    if (a.user_id === userId) return -1;
                                    if (b.user_id === userId) return 1;
                                    return (b.role === 'admin' ? 1 : 0) - (a.role === 'admin' ? 1 : 0);
                                })
                                .map((member) => {
                                    const assignedDevice = devices.find(d => d.pro_id === member.id);
                                    const currentTypeId = assignedDevice?.device_type_id || "";

                                    return (
                                        <div key={member.id} className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 relative">
                                            {member.user_id === userId && (
                                                <div className="absolute top-3 right-3">
                                                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full">MOI</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                                                    {member.first_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 text-sm">{member.first_name} {member.last_name}</p>
                                                    <p className="text-slate-400 text-xs">{member.job_title || member.role}</p>
                                                </div>
                                            </div>

                                            {/* Device Selector */}
                                            <div className="bg-slate-50 p-2 rounded-lg flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Smartphone className={`w-4 h-4 ${assignedDevice ? 'text-emerald-500' : 'text-slate-300'}`} />
                                                    <span className="text-xs font-semibold text-slate-500">Terminal :</span>
                                                </div>
                                                {isAdmin ? (
                                                    <select
                                                        className="text-xs border-none bg-transparent font-medium text-slate-900 outline-none text-right pr-1"
                                                        value={currentTypeId}
                                                        onChange={(e) => assignDeviceType(member.id, e.target.value)}
                                                    >
                                                        <option value="">(Aucun)</option>
                                                        {deviceTypes.map(t => (
                                                            <option key={t.id} value={t.id}>{t.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs font-medium">{assignedDevice?.config_device_types?.label || "Aucun"}</span>
                                                )}
                                            </div>

                                            {isAdmin && member.user_id !== userId && (
                                                <div className="mt-2 text-right">
                                                    <button onClick={() => removeMember(member.id)} className="text-xs text-red-400 hover:text-red-600 underline">Retirer</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {!isAdmin && team.some(m => !devices.some(d => d.pro_id === m.id)) && (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-800 text-xs flex gap-2">
                        <div className="font-bold">⚠️</div>
                        <div>Attente Admin: Terminaux manquants.</div>
                    </div>
                )}
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-100 pb-8">
                <Button onClick={mode === 'solo' ? handleSoloSetup : proceedNext} className="w-full h-12 text-base font-semibold shadow-xl shadow-slate-200" disabled={!isAdmin && team.some(m => !devices.some(d => d.pro_id === m.id))}>
                    {mode === 'solo' ? "Configurer & Terminer" : "Suivant"}
                </Button>
            </div>
        </div>
    );
}
