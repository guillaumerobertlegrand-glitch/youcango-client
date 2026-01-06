"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function ClientServiceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const supabase = createClient();

    useEffect(() => {
        if (!sessionId || sessionId === 'undefined') {
            console.error("[ClientService] Missing or Invalid Session ID:", sessionId);
            router.push('/');
            return;
        }

        console.log("[ClientService] Initializing for Session:", sessionId);

        let channel: any;
        let pollInterval: NodeJS.Timeout;

        const checkStatus = async () => {
            if (!sessionId) return false;
            try {
                const { data: session, error } = await supabase
                    .from('sessions')
                    .select('state')
                    .eq('id', sessionId)
                    .single();

                if (error) {
                    console.error("[ClientService] Check Error:", error);
                    return false;
                }

                console.log("[ClientService] Fetched Session State:", session?.state);

                if (session && session.state === 'completed') {
                    console.log("[ClientService] Check detected completion! Redirecting...");
                    router.push(`/client/payment?session_id=${sessionId}`);
                    return true;
                }
            } catch (err) {
                console.error("[ClientService] Exception checking status:", err);
            }
            return false;
        };

        const initRealtime = async () => {
            if (await checkStatus()) return;

            channel = supabase
                .channel(`client-service-${sessionId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'sessions',
                        filter: `id=eq.${sessionId}`
                    },
                    async (payload) => {
                        console.log("[ClientService] Session Update Recieved:", payload);
                        if (payload.new.state === 'completed') {
                            console.log("[ClientService] Realtime Completed! Redirecting...");
                            router.push(`/client/payment?session_id=${sessionId}`);
                        }
                    }
                )
                .subscribe((status) => {
                    console.log("[ClientService] Subscription Status:", status);
                });
        };

        initRealtime();

        pollInterval = setInterval(() => {
            console.log("[ClientService] Polling for", sessionId);
            checkStatus();
        }, 3000);

        return () => {
            clearInterval(pollInterval);
            if (channel) supabase.removeChannel(channel);
        };

    }, [sessionId, router, supabase]);

    if (!sessionId) return null;

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans items-center justify-center relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-50 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-slate-50 rounded-full blur-[100px]" />
            </div>

            {/* Content centered */}
            <div className="animate-in fade-in duration-1000 z-10 flex flex-col items-center gap-12 max-w-[80vw]">
                {/* Timer Circle */}
                <div className="relative flex items-center justify-center w-64 h-64">
                    {/* Pulsing rings */}
                    <div className="absolute inset-0 bg-green-500/10 rounded-full animate-ping duration-[3s]" />
                    <div className="absolute inset-4 bg-green-500/10 rounded-full animate-ping duration-[3s] delay-700" />

                    <div className="relative w-full h-full glass rounded-full flex flex-col items-center justify-center border border-white/40 shadow-2xl backdrop-blur-3xl">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Elapsed</span>
                        <div className="text-5xl font-black text-slate-800 tracking-tighter tabular-nums variant-numeric-tabular-nums">
                            12:45
                        </div>
                        <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-green-100/50 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Active</span>
                        </div>
                    </div>
                </div>

                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Haircut in progress</h2>
                    <p className="text-slate-400 font-medium">Relax, enjoy your service.</p>
                </div>

                <div className="absolute bottom-12 left-0 right-0 flex justify-center opacity-60">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-1 rounded-full bg-slate-200" />
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Do not close</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ClientServicePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading Service...</div>}>
            <ClientServiceContent />
        </Suspense>
    );
}
