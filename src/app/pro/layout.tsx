import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ProSessionListener from "@/components/ProSessionListener";
import ProHeaderSettings from "@/components/ProHeaderSettings";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "YouCanGo Pro",
    description: "Professional Interface",
};

export default async function ProLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <main className={`flex flex-col h-screen bg-white max-w-md mx-auto relative font-sans ${inter.className}`}>
            <ProSessionListener />

            {/* Pro Header (Flex Item - Stays at top) */}
            <header className="flex-shrink-0 z-50 glass pt-12 pb-2 px-6 border-b border-slate-200/50">
                <div className="flex items-center justify-between h-[44px]">
                    <div className="flex items-center gap-1">
                        <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">YouCanGo</h1>
                        <span className="text-2xl font-black tracking-tighter text-slate-400">Pro</span>
                    </div>
                    {/* Settings Gear */}
                    <ProHeaderSettings />
                </div>
            </header>

            {/* Scrollable Content (Fills remaining space) */}
            <div className="flex-1 flex flex-col overflow-y-auto hide-scrollbar relative">
                {children}
            </div>
        </main>
    );
}
