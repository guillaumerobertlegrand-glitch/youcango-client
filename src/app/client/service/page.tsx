"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Settings } from "lucide-react"; // Import Settings icon
import { Button } from "@/components/ui/button";

function ClientServiceContent() {
    const [monetizationModel, setMonetizationModel] = useState<string | null>(null);

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
                    .select('state, monetization_model')
                    .eq('id', sessionId)
                    .single();

                if (error) {
                    console.error("[ClientService] Check Error:", error);
                    return false;
                }

                if (session?.monetization_model) {
                    setMonetizationModel(session.monetization_model);
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
        <main className="flex flex-col h-screen bg-white max-w-md mx-auto relative overflow-hidden font-sans">
            {/* Native-like Status Bar / Header */}
            <header className="flex-shrink-0 z-50 px-6 pt-12 pb-4 glass flex items-center justify-between relative bg-white/50 backdrop-blur-md">
                <h1 className="text-2xl font-black tracking-tighter text-slate-900 cursor-default">
                    YouCanGo
                </h1>
                <Button variant="ghost" size="icon" className="text-slate-900 hover:bg-slate-100 transition-colors">
                    <Settings size={34} className="stroke-[2.5px]" />
                </Button>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 relative flex flex-col items-center justify-center">

                {/* Background Decoration */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-50 rounded-full blur-[100px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-slate-50 rounded-full blur-[100px]" />
                </div>

                {/* Content centered */}
                <div className="animate-in fade-in duration-1000 z-10 flex flex-col items-center gap-12 w-full px-6">
                    {/* Zen Circle */}
                    <div className="relative flex items-center justify-center w-72 h-72">
                        {/* Soft Pulsing rings - Zen style (slower, cleaner) */}
                        <div className="absolute inset-0 bg-green-500/5 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]" />
                        <div className="absolute inset-8 bg-green-500/5 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite] delay-1000" />

                        <div className="relative w-full h-full glass rounded-full flex flex-col items-center justify-center border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-3xl bg-white/40">
                            <h2 className="text-2xl font-bold text-slate-800 tracking-tight text-center px-6 leading-tight">
                                {monetizationModel === 'subscription' ? (
                                    <>Transaction<br />in progress</>
                                ) : (
                                    <>Service<br />in progress</>
                                )}
                            </h2>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function ClientServicePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading Service...</div>}>
            <ClientServiceContent />
        </Suspense>
    );
}
