"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function ActiveSessionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');

    // Supabase
    const supabase = createClient();

    // Simulation State
    const [eta, setEta] = useState<number | null>(null); // Start null until fetched
    const [statusText, setStatusText] = useState("Client is on his way");
    const [isApproaching, setIsApproaching] = useState(false);
    const [isInProgress, setIsInProgress] = useState(false);
    const [serviceName, setServiceName] = useState<string>("Service");
    const [isCompleting, setIsCompleting] = useState(false);
    const [isMerchant, setIsMerchant] = useState(false); // Added state

    // Initial Fetch (Synchronize ETA)
    useEffect(() => {
        if (!sessionId) return;
        const fetchSession = async () => {
            const { data } = await supabase
                .from('sessions')
                .select('estimated_arrival_duration, state, service_requested, monetization_model') // Added monetization_model
                .eq('id', sessionId)
                .single();

            if (data?.estimated_arrival_duration) {
                setEta(data.estimated_arrival_duration);
            } else {
                setEta(12); // Fallback
            }

            if (data?.service_requested) {
                setServiceName(data.service_requested);
            }

            if (data?.monetization_model === 'subscription') {
                setIsMerchant(true);
            }

            if (data?.state === 'in_progress') {
                setIsInProgress(true);
            }
        };
        fetchSession();

        // Realtime Listener for ETA Updates
        const channel = supabase
            .channel(`session-pro-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `id=eq.${sessionId}`
                },
                (payload) => {
                    // Update ETA dynamically as Client moves
                    if (payload.new.estimated_arrival_duration) {
                        setEta(payload.new.estimated_arrival_duration);
                    }
                    if (payload.new.state) {
                        if (payload.new.state === 'in_progress') setIsInProgress(true);
                        // Add other state transitions if needed
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId]);

    // ... (rest of logic)
    const handleCompletion = async () => {
        if (!sessionId) return;
        setIsCompleting(true);
        try {
            const { error } = await supabase.rpc('api_v1_complete_session', { p_session_id: sessionId });
            if (error) throw error;
            router.push(`/pro/completion?session_id=${sessionId}`);
        } catch (err) {
            console.error("Error completing session:", err);
            setIsCompleting(false);
        }
    };

    const handleStartService = async () => {
        // Dev Trigger / Fallback
        if (!sessionId) return;
        await supabase.rpc('api_v1_start_service', { p_session_id: sessionId });
        setIsInProgress(true);
        setIsApproaching(false);
    };

    return (
        <div className="flex flex-col w-full h-full relative">
            {/* ... */}
            <div className="flex-1 flex flex-col px-6 pt-8 pb-32 z-10 w-full justify-center">
                {/* Status Box - P3/P4/P5 */}
                {isInProgress ? (
                    isMerchant ? (
                        // Merchant Passive Mode
                        <div className="flex-1 flex flex-col justify-center items-center gap-12">
                            <div className="text-center relative">
                                <div className="absolute inset-0 bg-green-500/10 blur-2xl rounded-full animate-pulse z-0"></div>
                                <h2 className="relative z-10 text-4xl font-black leading-[1.1] tracking-tight text-slate-900 animate-pulse">
                                    Client<br />in store
                                </h2>
                            </div>
                            <div className="text-xl text-slate-500 font-medium">
                                No action needed
                            </div>
                        </div>
                    ) : (
                        // Service Active Mode (Original)
                        <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700">

                            {/* Center Content (Zen Circle) */}
                            <div className="flex-1 flex items-center justify-center">
                                {/* Zen Circle - Matching C5 Style */}
                                <div className="relative flex items-center justify-center w-72 h-72">
                                    {/* Soft Pulsing rings - Zen style (slower, cleaner) */}
                                    <div className="absolute inset-0 bg-green-500/5 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]" />
                                    <div className="absolute inset-8 bg-green-500/5 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite] delay-1000" />

                                    <div className="relative w-full h-full glass rounded-full flex flex-col items-center justify-center border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-3xl bg-white/40">
                                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight text-center px-6 leading-tight">
                                            Service<br />in progress
                                        </h2>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom CTA */}
                            <div className="flex-shrink-0 w-full pb-8">
                                <Button
                                    onClick={handleCompletion}
                                    disabled={isCompleting}
                                    size="lg"
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-16 text-lg font-bold shadow-xl shadow-slate-200/50 transform transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {isCompleting ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Completing...
                                        </span>
                                    ) : (
                                        "Complete Session"
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) // Close isMerchant false block
                ) : ( // Close isInProgress true block & start false block
                    <div className="flex-1 flex flex-col justify-center items-center gap-12">

                        <div className="text-center relative">
                            {isApproaching && (
                                <div className="absolute inset-0 bg-red-500/10 blur-2xl rounded-full animate-pulse z-0"></div>
                            )}
                            <h2 className={`relative z-10 text-4xl font-black leading-[1.1] tracking-tight transition-colors duration-500 ${isApproaching ? "text-slate-900 animate-pulse" : "text-slate-400"}`}>
                                {statusText}
                            </h2>
                        </div>

                        <div
                            onClick={() => handleStartService()} // Dev Trigger
                            className="flex flex-col items-center justify-center cursor-pointer group"
                        >
                            {/* ETA Number */}
                            <div className={`text-[120px] leading-none font-black tracking-tighter transition-all duration-500 ${isApproaching ? "text-slate-900 scale-110" : "text-slate-400"}`}>
                                {eta}<span className={`text-4xl align-top ml-2 font-bold ${isApproaching ? "text-slate-900" : "text-slate-400"}`}>min</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
