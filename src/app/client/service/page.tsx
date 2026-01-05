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
            <div className="animate-in fade-in duration-700 z-10 flex flex-col items-center gap-8">
                <div className="bg-white/80 backdrop-blur-md px-8 py-5 rounded-full shadow-xl border border-slate-100 flex items-center gap-5 transform scale-125">
                    <div className="h-4 w-4 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-200" />
                    <div className="flex flex-col">
                        <span className="text-xl font-black text-slate-800 tracking-tight">Haircut in progress</span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">By Victor</span>
                    </div>
                </div>

                <p className="text-slate-300 text-sm font-medium animate-pulse">Your map will return after service</p>
                <p className="text-xs text-slate-200 font-mono mt-4">Session: {sessionId.slice(0, 8)}...</p>
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
