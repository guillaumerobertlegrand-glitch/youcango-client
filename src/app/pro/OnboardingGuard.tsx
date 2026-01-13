"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function OnboardingGuard({ pro }: { pro: any }) {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!pro || !pro.organization) return;

        // Handle array response from Supabase (sometimes single() fails if RLS weirdness or just typescript assumption)
        // Check if organization is an array or object
        const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;

        if (!org) return;

        const status = org.onboarding_status;

        // If Onboarding is NOT complete
        if (status !== 'completed') {
            // Allow access ONLY to onboarding page
            if (!pathname.includes('/pro/onboarding')) {
                console.log("[Guard] Redirecting to Onboarding...");
                router.push('/pro/onboarding');
            }
        }
    }, [pro, pathname, router]);

    return null;
}
