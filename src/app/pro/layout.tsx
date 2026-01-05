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
            {/* Pro Header */}
            <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tight">YouCanGo <span className="text-blue-400">Pro</span></h1>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partner Interface</span>
                </div>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto pb-24">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 safe-area-bottom">
                <Link href="/pro" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-900 transition-colors group">
                    <div className="p-2 rounded-xl group-hover:bg-slate-100 transition-colors">
                        <LayoutDashboard size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Requests</span>
                </Link>

                <Link href="/pro/services" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-900 transition-colors group">
                    <div className="p-2 rounded-xl group-hover:bg-slate-100 transition-colors">
                        <List size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Services</span>
                </Link>

                <Link href="/pro/settings" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-900 transition-colors group">
                    <div className="p-2 rounded-xl group-hover:bg-slate-100 transition-colors">
                        <Settings size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Settings</span>
                </Link>
            </nav>
        </div>
    );
}
