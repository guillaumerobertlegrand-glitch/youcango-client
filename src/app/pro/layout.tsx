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

export default function ProLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className={`min-h-screen bg-slate-50 flex flex-col font-sans ${inter.className}`}>
            <ProSessionListener />
            {/* Pro Header (Native Style) */}
            <header className="fixed top-0 left-0 right-0 z-50 glass pt-safe-top px-6 pb-2 border-b border-slate-200/50">
                <div className="flex items-center justify-between h-[44px]">
                    <div className="flex flex-col justify-center">
                        <h1 className="text-[17px] font-black tracking-tight text-slate-900 leading-none">YouCanGo</h1>
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Partner</span>
                    </div>
                </div>
            </header>

            {/* Scrollable Content (Safe Area Padding) */}
            <main className="flex-1 overflow-y-auto pb-32 pt-24 px-4 hide-scrollbar">
                {children}
            </main>

            {/* Bottom Navigation (Floating Glass) */}
            <nav className="fixed bottom-6 left-4 right-4 z-50 glass-card rounded-3xl p-1 flex justify-between items-center bg-white/90">
                <Link href="/pro" className="flex-1 flex flex-col items-center gap-1 py-3 text-slate-400 hover:text-blue-600 transition-colors group">
                    <LayoutDashboard size={24} className="group-hover:scale-110 transition-transform" />
                </Link>

                <div className="w-px h-8 bg-slate-200"></div>

                <Link href="/pro/services" className="flex-1 flex flex-col items-center gap-1 py-3 text-slate-400 hover:text-blue-600 transition-colors group">
                    <List size={24} className="group-hover:scale-110 transition-transform" />
                </Link>

                <div className="w-px h-8 bg-slate-200"></div>

                <Link href="/pro/settings" className="flex-1 flex flex-col items-center gap-1 py-3 text-slate-400 hover:text-blue-600 transition-colors group">
                    <Settings size={24} className="group-hover:scale-110 transition-transform" />
                </Link>
            </nav>
        </div>
    );
}
