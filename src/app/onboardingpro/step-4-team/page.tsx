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

    // Invite
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteFirstName, setInviteFirstName] = useState("");
    const [inviteLastName, setInviteLastName] = useState("");

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");
            setUserId(user.id);

            // 1. Check Professionals first (Source of Truth for Access/Org Link)
            const { data: pro } = await supabase.from('professionals').select('organization_id, role').eq('user_id', user.id).maybeSingle();

            if (pro && pro.organization_id) {
                setOrgId(pro.organization_id);
                // Assume admin if they are here in onboarding flow, or strict check
                setIsAdmin(pro.role === 'admin');
                fetchData(pro.organization_id);
            } else {
                // Should not happen if Dispatcher sent us here, but safe fallback
                router.push("/onboardingpro");
            }
        }
        init();
    }, [router, supabase]);

    // ... (fetchData stays same) ...

    // Actions
    // ...

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

                {/* Invite Section - Always visible if admin, or force visible per request? 
                    User said: "Le formulaire ... doit être visible en permanence, peu importe s'il y a déjà des membres ou non."
                    If user is somehow not admin, they shouldn't see it? But in onboarding they are admin.
                    So isAdmin check is fine provided it is TRUE.
                 */}
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
