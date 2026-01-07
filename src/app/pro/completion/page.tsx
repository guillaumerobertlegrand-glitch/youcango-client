"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function CompletionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [flash, setFlash] = useState(true);
    const [proName, setProName] = useState("Victor"); // Default fallback
    const supabase = createClient(); // Instantiate Supabase

    useEffect(() => {
        // Fetch Pro Name
        const fetchProName = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('first_name')
                    .eq('id', user.id)
                    .single();
                if (profile?.first_name) {
                    setProName(profile.first_name);
                }
            }
        };
        fetchProName();

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
        <div className="flex flex-col h-full pt-8 pb-8 px-6">
            {/* Flash Overlay */}
            <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-1000 z-50 ${flash ? 'opacity-50' : 'opacity-0'}`} />

            {/* Spacer to push content to center */}
            <div className="flex-1" />

            {/* Center Block: Banner + Info */}
            <div className="w-full flex flex-col gap-6">
                {/* Completed Banner - Medium Gray */}
                <div className="w-full bg-slate-200 py-8 text-center rounded-2xl animate-in fade-in slide-in-from-top-4 duration-700 shadow-sm border border-slate-300">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                        Service completed
                    </h2>
                </div>

                {/* Timeline / Info - Right Aligned & Thinner */}
                <div className="w-full text-right animate-in fade-in duration-1000 delay-300">
                    <p className="text-lg font-normal text-slate-900">{proName}</p>
                    <p className="text-lg font-normal text-slate-500 mt-0">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>

            {/* Spacer to push pill to bottom */}
            <div className="flex-1" />

            {/* Settlement Notice - SMS Style Bottom Left - Medium Gray, Small Text */}
            <div className="w-3/4 self-start bg-slate-200 rounded-[24px] rounded-bl-sm p-4 text-left shadow-sm animate-in slide-in-from-left-4 duration-700 delay-200 border border-slate-300 mb-4">
                <p className="text-sm font-medium text-slate-700 leading-snug">
                    This session will be settled via YouCanGo
                </p>
            </div>
        </div>
    );
}
