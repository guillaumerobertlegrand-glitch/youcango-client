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
        <div className="flex flex-col h-full items-center justify-center pt-8">
            {/* Flash Overlay */}
            <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-1000 z-50 ${flash ? 'opacity-50' : 'opacity-0'}`} />

            {/* Completed Banner */}
            <div className="w-full bg-slate-200 py-6 text-center rounded-sm mb-2 animate-in fade-in slide-in-from-bottom-4 duration-700 h-fit">
                <h2 className="text-3xl font-black text-slate-700 uppercase tracking-tight">
                    Haircut completed
                </h2>
            </div>

            <div className="w-full text-right mb-12 animate-in fade-in duration-1000 delay-300 h-fit">
                <p className="text-slate-900 font-medium">Victor</p>
                <p className="text-slate-600">Today - {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            {/* Settlement Notice */}
            <div className="w-full bg-slate-200/80 backdrop-blur-sm rounded-[32px] rounded-tl-none p-6 text-left shadow-sm animate-in zoom-in-95 duration-700 delay-150 relative overflow-hidden h-fit">
                {/* Subtle Flash inside pill */}
                <div className="absolute inset-0 bg-white/40 animate-[ping_1s_ease-out_1]" />

                <p className="text-xl font-medium text-slate-800 leading-tight relative z-10">
                    This session will be settled via YouCanGo
                </p>
            </div>
        </div>
    );
}
