import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Settings, LayoutDashboard, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ProSessionListener from "@/components/ProSessionListener";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "YouCanGo Pro",
    description: "Professional Interface",
};

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function ProLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // 1. Check Authentication & Onboarding Status
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // 2. Fetch Professional Profile & Org Status
    const { data: pro } = await supabase
        .from('professionals')
        .select(`
            id, 
            role, 
            organization:organizations (
                id, 
                onboarding_status,
                onboarding_step
            )
        `)
        .eq('user_id', user.id)
        .single();

    // 3. Navigation Guard Logic
    if (pro && pro.organization) {
        // @ts-ignore
        const org = pro.organization;

        // Get current path to avoid infinite loop
        const headersList = await headers();
        // Identify if we are already on onboarding page based on headers or simple assumption
        // Since we can't easily get pathname in Server Component without middleware header injection,
        // we might need a workaround or assume middleware passes it.
        // EASIER: Checks done in Middleware usually, but for specific layout logic:

        // Logic: If status != 'completed', force onboarding.
        if (org.onboarding_status !== 'completed') {
            // We can't check pathname easily here without 'x-url' header trick.
            // But we can check if children is NOT the onboarding page? No.
            // Use Client Component wrapper for the Guard?
            // Or just do it in the Page components?
            // Best practice for Next.js App Dir: Middleware or specialized Component.

            // Let's defer strict redirection to the Page components (Dashboard) OR use a specific check if we know we are avoiding middleware.
            // User requested "Layout Guard".
            // Let's inject a Client Component Guard that checks pathname.
        }
    }

    return (
        <main className={`flex flex-col h-screen bg-white max-w-md mx-auto relative font-sans ${inter.className}`}>
            <ProSessionListener />
            <OnboardingGuard pro={pro} />

            {/* Pro Header (Flex Item - Stays at top) */}
            <header className="flex-shrink-0 z-50 glass pt-12 pb-2 px-6 border-b border-slate-200/50">
                <div className="flex items-center justify-between h-[44px]">
                    <div className="flex items-center gap-1">
                        <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">YouCanGo</h1>
                        <span className="text-2xl font-black tracking-tighter text-slate-400">Pro</span>
                    </div>
                    {/* Settings Gear */}
                    <Button variant="ghost" size="icon" className="text-slate-900 hover:bg-slate-100 transition-colors">
                        <Settings size={34} className="stroke-[2.5px]" />
                    </Button>
                </div>
            </header>

            {/* Scrollable Content (Fills remaining space) - Removed global padding for edge-to-edge flexibility */}
            <div className="flex-1 flex flex-col overflow-y-auto hide-scrollbar relative">
                {children}
            </div>
        </main>
    );
}

// Client Component for Guarding Path
import OnboardingGuard from "./OnboardingGuard";
