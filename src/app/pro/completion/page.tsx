"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CompletionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [flash, setFlash] = useState(true);

    useEffect(() => {
        // Flash Effect reset
        const timer = setTimeout(() => setFlash(false), 500);

        // Auto Dismiss
        const dismissTimer = setTimeout(() => {
            if (sessionId) {
                router.push(`/pro/payment?session_id=${sessionId}`);
            } else {
                router.push("/pro");
            }
        }, 5000);

        return () => {
            clearTimeout(timer);
            clearTimeout(dismissTimer);
        };
    }, [router, sessionId]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden">
            {/* Flash Overlay */}
            <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-1000 z-50 ${flash ? 'opacity-50' : 'opacity-0'}`} />

            {/* Header */}
            <header className="px-6 py-6 flex items-center justify-between z-10">
                <h1 className="text-2xl font-black tracking-tight">YouCanGo</h1>
                <Button variant="ghost" size="icon" className="text-slate-900">
                    <Settings size={24} />
                </Button>
            </header>

            <main className="flex-1 flex flex-col px-6 pt-12 pb-6 w-full max-w-md mx-auto items-center justify-center">

                {/* Completed Banner */}
                <div className="w-full bg-slate-200 py-6 text-center rounded-sm mb-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-3xl font-black text-slate-700 uppercase tracking-tight">
                        Haircut completed
                    </h2>
                </div>

                <div className="w-full text-right mb-12 animate-in fade-in duration-1000 delay-300">
                    <p className="text-slate-900 font-medium">Victor</p>
                    <p className="text-slate-600">Today - {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>

                {/* Settlement Notice */}
                <div className="w-full bg-slate-200/80 backdrop-blur-sm rounded-[32px] rounded-tl-none p-6 text-left shadow-sm animate-in zoom-in-95 duration-700 delay-150 relative overflow-hidden">
                    {/* Subtle Flash inside pill */}
                    <div className="absolute inset-0 bg-white/40 animate-[ping_1s_ease-out_1]" />

                    <p className="text-xl font-medium text-slate-800 leading-tight relative z-10">
                        This session will be settled via YouCanGo
                    </p>
                </div>

                {/* Behavior Hints (Dev Mode Only - Optional) */}
                {/* <div className="mt-8 text-xs text-blue-400 text-left w-full">
                    [Behavior]<br/>
                    Auto-dismiss logic engaged.<br/>
                    Returns silently to P1.
                </div> */}

            </main>
        </div>
    );
}
