import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "YouCanGo Pro",
    description: "Professional Interface",
};

import ProSessionListener from "@/components/ProSessionListener";

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
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full h-10 w-10">
                    <Settings size={20} />
                </Button>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto pb-safe">
                {children}
            </main>
        </div>
    );
}
