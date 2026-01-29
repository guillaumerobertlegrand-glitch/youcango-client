"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OnboardingDispatcher() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Creation Form
    const [newOrgName, setNewOrgName] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    useEffect(() => {
        async function checkState() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.push("/login");

                const { data: pro } = await supabase
                    .from('professionals')
                    .select('role, organization:organizations(onboarding_step)')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (pro && pro.organization) {
                    // Organization exists -> Redirect to Current Step
                    // @ts-ignore
                    const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;

                    // CHECK ROLE: If team_member, skip onboarding and go to Dashboard (Frame P1)
                    // We assume 'role' column exists on 'professionals' table based on requirements
                    // @ts-ignore
                    if (pro.role === 'team_member') {
                        router.push('/pro/active-session');
                        return;
                    }

                    const step = org.onboarding_step || 1;

                    const routes = {
                        1: '/onboardingpro/step-1-identity',
                        2: '/onboardingpro/step-2-finance',
                        3: '/onboardingpro/step-3-catalog',
                        4: '/onboardingpro/step-4-team',
                        5: '/onboardingpro/step-5-skills',
                        6: '/onboardingpro/step-6-ready'
                    };

                    // @ts-ignore
                    router.push(routes[step] || routes[1]);
                } else {
                    // No Org -> Redirect to Step 1 (Bootstrap Mode)
                    router.push("/onboardingpro/step-1-identity");
                }
            } catch (e) {
                console.error("Dispatcher Error:", e);
                setLoading(false);
            }
        }
        checkState();
    }, [supabase, router]);

    // Loading State
    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    // Dispatcher logic handles redirection.
    // If we are still here (and not creating), it implies a redirection is pending or failed.
    // But for the new "Fresh Start" flow, we simply redirect to Step 1.
    return null;
}
