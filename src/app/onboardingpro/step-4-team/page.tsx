"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Plus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IOSSection, IOSRow } from "@/components/ui/ios-settings";
import { cn } from "@/lib/utils";


export default function Step4TeamPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Data
    const [team, setTeam] = useState<any[]>([]);

    const [myFirstName, setMyFirstName] = useState("");
    const [myLastName, setMyLastName] = useState("");

    // Invite
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteFirstName, setInviteFirstName] = useState("");
    const [inviteLastName, setInviteLastName] = useState("");

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");
            setUserId(user.id);

            // 1. Fetch Profile for Name Pre-fill & Access Check (Source of Truth for Org Link via organization_id)
            const { data: profile } = await supabase.from('profiles')
                .select('first_name, last_name, organization_id, role')
                .eq('id', user.id)
                .maybeSingle();

            if (profile) {
                setMyFirstName(profile.first_name || "");
                setMyLastName(profile.last_name || "");

                if (profile.organization_id) {
                    setOrgId(profile.organization_id);
                    setIsAdmin(profile.role === 'admin');
                    fetchData(profile.organization_id);
                } else {
                    // Fallback using Professionals table if profile link missing (legacy safety)
                    const { data: pro } = await supabase.from('professionals').select('organization_id, role').eq('user_id', user.id).maybeSingle();
                    if (pro && pro.organization_id) {
                        setOrgId(pro.organization_id);
                        setIsAdmin(pro.role === 'admin');
                        fetchData(pro.organization_id);
                    } else {
                        router.push("/onboardingpro");
                    }
                }
            } else {
                router.push("/onboardingpro");
            }
        }
        init();
    }, [router, supabase]);

    const saveMyProfile = async () => {
        if (!userId) return;
        await supabase.from('profiles').update({
            first_name: myFirstName,
            last_name: myLastName
        }).eq('id', userId);
    };

    const fetchData = async (oid: string) => {
        setLoading(true);

        // 1. Fetch Active Profiles (linked via organization_id)
        const { data: activeMembers, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', oid);

        if (profilesError) console.error("Profiles fetch error:", profilesError);

        // 2. Fetch Pending Invitations (linked via organization_id)
        const { data: pendingInvites, error: invitesError } = await supabase
            .from('invitations')
            .select('*')
            .eq('organization_id', oid);

        if (invitesError) console.error("Invitations fetch error:", invitesError);

        // 3. Merge & Map
        const formattedActive = (activeMembers || []).map((p: any) => ({
            id: p.id,
            user_id: p.id, // Profile ID is usually User ID
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email, // Assuming profiles has email or we need to fetch it differently? User implies it's available.
            role: p.role || 'member', // Default to member if not specified
            status: 'active'
        }));

        const formattedPending = (pendingInvites || []).map((i: any) => ({
            id: i.id,
            user_id: null,
            first_name: i.first_name || "Invité",
            last_name: i.last_name || "",
            email: i.email,
            role: i.role || 'member',
            status: 'pending_invite'
        }));

        setTeam([...formattedActive, ...formattedPending]);
        setLoading(false);
    };

    // Actions
    const sendInvite = async () => {
        if (!orgId) return;
        setLoading(true);
        // Default Role: Member
        const res = await fetch('/api/invite-member', {
            method: 'POST',
            body: JSON.stringify({
                email: inviteEmail,
                organization_id: orgId,
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
        // Note: active members use user_id as ID in formattedActive. RPC likely expects pro_id.
        // If this fails, we need to fetch professional_id first.
        const { data, error } = await supabase.rpc('api_v1_remove_team_member', { p_pro_id: proId, p_org_id: orgId });
        if (error || !data.success) {
            alert("Erreur: " + (error?.message || data?.error));
            setLoading(false);
        } else {
            fetchData(orgId!);
        }
    };

    const handleNext = async () => {
        if (!orgId) return;

        // Validation: At least one member (yourself) is guaranteed. 
        // We might want to encourage verifying info.

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

    // Derived myPro is no longer needed for isAdmin check
    const myPro = team.find(p => p.user_id === userId);

    return (
        <div className="h-full font-sans bg-[#F2F2F7] relative overflow-hidden flex flex-col">

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-6">

                {/* Header */}
                <header className="mt-10 px-6 mb-2">
                    <h1 className="text-[22px] font-bold text-black tracking-tight">
                        Équipe
                    </h1>
                    <p className="text-[17px] text-[#000000] mt-2 leading-relaxed">
                        Gérez les membres de votre établissement.
                    </p>
                </header>

                {/* Team List */}
                <IOSSection title="Membres">
                    {team.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-[15px]">
                            Votre équipe est vide, commencez par inviter un collaborateur 👇
                        </div>
                    ) : (
                        team
                            .sort((a, b) => {
                                if (a.user_id === userId) return -1;
                                if (b.user_id === userId) return 1;
                                return (b.role === 'admin' ? 1 : 0) - (a.role === 'admin' ? 1 : 0);
                            })
                            .map((member, idx) => {
                                const isMe = member.user_id === userId;
                                const label = `${member.first_name} ${member.last_name}${isMe ? " (Moi)" : ""}`;
                                const roleLabel = member.role === 'admin' ? "Admin" : "Membre";

                                return (
                                    <IOSRow
                                        key={member.id}
                                        label={label}
                                        separator={idx !== team.length - 1}
                                    >
                                        <div className="flex items-center gap-2 justify-end w-full relative">
                                            <span className="text-[17px] text-[#8E8E93] mr-2">
                                                {roleLabel}
                                            </span>

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
                            })
                    )}
                </IOSSection>

                {/* Invite Section */}
                {isAdmin && (
                    <IOSSection title="Inviter un collaborateur">
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

            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 z-10 relative mt-auto pb-6 pt-2 bg-[#F2F2F7]/80 backdrop-blur-md border-t border-[#C6C6C8]/30">
                <div className="px-4">
                    <Button
                        onClick={handleNext}
                        disabled={loading}
                        className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-bold text-[17px] h-12 rounded-[16px]"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : "Continuer"}
                    </Button>
                </div>
            </div>

        </div>
    );
}
