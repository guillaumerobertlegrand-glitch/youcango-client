"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Check, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IOSSection, IOSRow } from "@/components/ui/ios-settings";
import { cn } from "@/lib/utils";


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

    // Invite
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteFirstName, setInviteFirstName] = useState("");
    const [inviteLastName, setInviteLastName] = useState("");

    // Solo Device Form
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
            await supabase.rpc('api_v1_assign_device_type', { p_pro_id: myProId, p_type_id: soloDeviceTypeId, p_org_id: orgId });

            // Auths (Service Permissions)
            const { data: services } = await supabase.from('services').select('id').eq('organization_id', orgId);
            if (services && services.length > 0) {
                const auths = services.map(s => ({ professional_id: myProId, service_id: s.id, authorized: true, priority: 1, skill_level: 'expert' }));
                await supabase.from('professional_service_authorizations').upsert(auths, { onConflict: 'professional_id, service_id' });
            }
        }

        // Refresh data and Validate
        const { data: freshDevs } = await supabase.from('devices').select('*').eq('organization_id', orgId);
        setDevices(freshDevs || []);

        const { data: v4 } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 4, p_org_id: orgId });
        const { data: v5 } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 5, p_org_id: orgId });

        if (v4.valid && v5.valid) {
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
        // Default Role: Editor
        const res = await fetch('/api/invite-editor', {
            method: 'POST',
            body: JSON.stringify({
                email: inviteEmail,
                organization_id: orgId,
                role: 'editor',
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

        const unequipped = team.filter(member => !devices.some(d => d.pro_id === member.id && d.status === 'active'));
        if (unequipped.length > 0) {
            alert(`Attention : Certains membres n'ont pas de terminal assigné (${unequipped.map(m => m.first_name).join(', ')}).\n\nVeuillez sélectionner un type d'appareil pour chacun.`);
            return;
        }

        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', { p_step: 4, p_org_id: orgId });
        if (result.valid) {
            await supabase.from('organizations').update({ onboarding_step: 5 }).eq('id', orgId);
            router.push("/onboardingpro/step-5-skills");
        } else {
            alert("Validation incomplète : " + JSON.stringify(result.details));
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-500" /></div>;

    const myPro = team.find(p => p.user_id === userId);
    const isAdmin = myPro?.role === 'admin';
    const canManage = isAdmin;

    return (
        <div className="h-full font-sans bg-[#F2F2F7] relative overflow-hidden flex flex-col">

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-6">

                {/* Header */}
                <header className="mt-10 px-6 mb-2">
                    <h1 className="text-[22px] font-bold text-black tracking-tight">
                        Équipe & Outils
                    </h1>
                    <p className="text-[17px] text-[#000000] mt-2 leading-relaxed">
                        Qui utilisera YouCanGo ?
                    </p>
                </header>

                {/* Mode Selector */}
                <IOSSection title="Mode d'utilisation">
                    <IOSRow
                        label="Solo (Indépendant)"
                        onClick={() => canManage && setMode('solo')}
                        separator={true}
                    >
                        {mode === 'solo' && <Check className="w-5 h-5 text-[#007AFF]" />}
                    </IOSRow>
                    <IOSRow
                        label="Équipe (Plusieurs terminaux)"
                        onClick={() => canManage && setMode('team')}
                        separator={false}
                    >
                        {mode === 'team' && <Check className="w-5 h-5 text-[#007AFF]" />}
                    </IOSRow>
                </IOSSection>


                {mode === 'solo' ? (
                    <IOSSection title="Configuration">
                        <IOSRow label="Mon Terminal" separator={false}>
                            <div className="relative w-full flex items-center justify-end">
                                <span className={cn(
                                    "flex-1 text-right text-[17px] font-normal ml-auto",
                                    soloDeviceTypeId ? "text-[#3C3C43]" : "text-[#8E8E93]"
                                )}>
                                    {soloDeviceTypeId
                                        ? deviceTypes.find(t => t.id === soloDeviceTypeId)?.label
                                        : "Choisir..."}
                                </span>
                                <select
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                                    value={soloDeviceTypeId}
                                    onChange={e => setSoloDeviceTypeId(e.target.value)}
                                >
                                    <option value="" disabled>Choisir...</option>
                                    {deviceTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        </IOSRow>
                    </IOSSection>
                ) : (
                    <>
                        {/* Team List */}
                        <IOSSection title="Membres de l'équipe">
                            {team
                                .sort((a, b) => {
                                    if (a.user_id === userId) return -1;
                                    if (b.user_id === userId) return 1;
                                    return (b.role === 'admin' ? 1 : 0) - (a.role === 'admin' ? 1 : 0);
                                })
                                .map((member, idx) => {
                                    const assignedDevice = devices.find(d => d.pro_id === member.id);
                                    const currentTypeId = assignedDevice?.device_type_id || "";

                                    // Custom visual label with initials? IOSRow label is string. 
                                    // We'll just put Name in Label.
                                    const isMe = member.user_id === userId;
                                    const label = `${member.first_name} ${member.last_name}${isMe ? " (Moi)" : ""}`;

                                    return (
                                        <IOSRow
                                            key={member.id}
                                            label={label}
                                            separator={idx !== team.length - 1}
                                        >
                                            <div className="flex items-center gap-2 justify-end w-full relative">
                                                {/* Device Selector */}
                                                <div className="relative flex items-center justify-end min-w-[100px]">
                                                    <span className={cn(
                                                        "text-right text-[17px] font-normal truncate max-w-[140px]",
                                                        currentTypeId ? "text-[#3C3C43]" : "text-[#8E8E93]"
                                                    )}>
                                                        {currentTypeId
                                                            ? deviceTypes.find(t => t.id === currentTypeId)?.label
                                                            : "Assigner..."}
                                                    </span>
                                                    {isAdmin && (
                                                        <select
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                                                            value={currentTypeId}
                                                            onChange={e => assignDeviceType(member.id, e.target.value)}
                                                        >
                                                            <option value="" disabled>Choisir...</option>
                                                            {deviceTypes.map(t => (
                                                                <option key={t.id} value={t.id}>{t.label}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>

                                                {/* Delete Action (Admin only, not self) */}
                                                {isAdmin && !isMe && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeMember(member.id); }}
                                                        className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-full ml-2 active:bg-red-100 z-10 relative"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </IOSRow>
                                    );
                                })}
                        </IOSSection>

                        {/* Invite Section */}
                        {isAdmin && (
                            <IOSSection title="Nouveau Membre">
                                <IOSRow label="Prénom" separator={true}>
                                    <input
                                        className="w-full text-right bg-transparent outline-none text-[17px] text-[#3C3C43] placeholder:text-[#C7C7CC]"
                                        placeholder="Requis"
                                        value={inviteFirstName}
                                        onChange={e => setInviteFirstName(e.target.value)}
                                    />
                                </IOSRow>
                                <IOSRow label="Nom" separator={true}>
                                    <input
                                        className="w-full text-right bg-transparent outline-none text-[17px] text-[#3C3C43] placeholder:text-[#C7C7CC]"
                                        placeholder="Requis"
                                        value={inviteLastName}
                                        onChange={e => setInviteLastName(e.target.value)}
                                    />
                                </IOSRow>
                                <IOSRow label="Email" separator={true}>
                                    <input
                                        className="w-full text-right bg-transparent outline-none text-[17px] text-[#3C3C43] placeholder:text-[#C7C7CC]"
                                        placeholder="email@exemple.com"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        autoCapitalize="none"
                                        type="email"
                                    />
                                </IOSRow>
                                <div className="p-4">
                                    <Button
                                        onClick={sendInvite}
                                        disabled={!inviteEmail || !inviteFirstName || !inviteLastName}
                                        className="w-full bg-black text-white font-semibold h-11 rounded-[14px]"
                                    >
                                        <Plus className="w-5 h-5 mr-2" /> Inviter
                                    </Button>
                                </div>
                            </IOSSection>
                        )}
                    </>
                )}

            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 z-10 relative mt-auto pb-6 pt-2 bg-[#F2F2F7]/80 backdrop-blur-md border-t border-[#C6C6C8]/30">
                <div className="px-4">
                    <Button
                        onClick={mode === 'solo' ? handleSoloSetup : proceedNext}
                        disabled={loading || (!isAdmin && team.some(m => !devices.some(d => d.pro_id === m.id)))}
                        className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-bold text-[17px] h-12 rounded-[16px]"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : "Continuer"}
                    </Button>
                </div>
            </div>

        </div>
    );
}
