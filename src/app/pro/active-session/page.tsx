"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function ActiveSessionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const supabase = createClient();

    // STRICT STATE: Derived from DB
    const [dbState, setDbState] = useState<string | null>(null);
    const [eta, setEta] = useState<number | null>(null);
    const [serviceName, setServiceName] = useState<string>("Service");
    const [isMerchant, setIsMerchant] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    // Derived State (Robustness)
    const isApproaching = (eta !== null && eta <= 5);

    // 1. Initial Fetch
    useEffect(() => {
        if (!sessionId) return;
        const fetchSession = async () => {
            const { data } = await supabase
                .from('sessions')
                .select('estimated_arrival_duration, state, service_requested, monetization_model')
                .eq('id', sessionId)
                .single();

            if (data) {
                setDbState(data.state); // Source of Truth
                setEta(data.estimated_arrival_duration || 12);
                setServiceName(data.service_requested || "Service");
                if (data.monetization_model === 'subscription') setIsMerchant(true);

                // Auto-redirect if already completed
                if (data.state === 'completed') {
                    router.push(`/pro/completion?session_id=${sessionId}`);
                }
            }
        };
        fetchSession();

        // 2. Realtime State Sync
        const channel = supabase
            .channel(`session-pro-${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
                (payload) => {
                    const newState = payload.new.state;
                    if (newState) {
                        console.log("[ActiveSession] State Update:", newState);
                        setDbState(newState);
                        if (newState === 'completed') {
                            router.push(`/pro/completion?session_id=${sessionId}`);
                        }
                    }
                    if (payload.new.estimated_arrival_duration) {
                        setEta(payload.new.estimated_arrival_duration);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [sessionId, router]);

    // Actions
    const handleStartService = async () => {
        if (!sessionId) return;
        // Optimistic update
        setDbState('in_progress');
        await supabase.rpc('api_v1_start_service', { p_session_id: sessionId });
        // Realtime will confirm
    };

    const handleCompletion = async () => {
        if (!sessionId) {
            console.error("[ActiveSession] Error: sessionId is null or undefined.");
            return;
        }
        setIsCompleting(true);

        console.log('[ActiveSession] Session ID envoyé:', sessionId);
        console.log("[ActiveSession] Calling api_v1_complete_session with payload:", { p_session_id: sessionId });

        try {
            const { data, error } = await supabase.rpc('api_v1_complete_session', { p_session_id: sessionId });

            if (error) {
                console.error("[ActiveSession] RPC Error Full:", JSON.stringify(error, null, 2));
                console.error("[ActiveSession] RPC Error Message:", error.message);
                console.error("[ActiveSession] RPC Error Details:", error.details);
                console.error("[ActiveSession] RPC Error Hint:", error.hint);
                setIsCompleting(false);
                return;
            }

            console.log("[ActiveSession] RPC Response:", data);

            // Check for success flag in JSON response
            if (data && (data as any).success) {
                router.push(`/pro/completion?session_id=${sessionId}`);
            } else {
                console.error("[ActiveSession] Completion Failed (Business Logic):", data);
                setIsCompleting(false);
            }
        } catch (err: any) {
            console.error("[ActiveSession] Unexpected Exception:", JSON.stringify(err, null, 2));
            console.error("[ActiveSession] Exception Message:", err.message);
            setIsCompleting(false);
        }
    };

    // 3. Merchant Auto-Complete Timer (Top-Level Hook)
    // Must be defined here so handleCompletion is in scope
    useEffect(() => {
        if (dbState === 'in_progress' && isMerchant) {
            const timer = setTimeout(() => {
                console.log("[ActiveSession] Merchant Auto-Complete Triggered (10s)");
                handleCompletion();
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [dbState, isMerchant]);

    // --- RENDER LOGIC BASED ON DB STATE ---

    // P5: Service In Progress (state == 'in_progress')
    if (dbState === 'in_progress') {
        if (isMerchant) {
            // MERCHANT MODE (Passive P5)
            // Auto-complete handled by top-level useEffect

            return (
                <div className="flex-1 flex flex-col justify-center items-center gap-12 px-6 animate-in fade-in duration-1000">
                    {/* Zen Circle */}
                    <div className="relative flex items-center justify-center w-72 h-72">
                        {/* Soft Pulsing rings */}
                        <div className="absolute inset-0 bg-green-500/5 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]" />
                        <div className="absolute inset-8 bg-green-500/5 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite] delay-1000" />

                        <div className="relative w-full h-full glass rounded-full flex flex-col items-center justify-center border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-3xl bg-white/40">
                            <h2 className="text-2xl font-bold text-slate-800 tracking-tight text-center px-6 leading-tight">
                                Client<br />in store
                            </h2>
                        </div>
                    </div>
                </div>
            );
        } else {
            // SERVICE MODE (Active P5)
            return (
                <div className="w-full h-full flex flex-col px-6 pt-8 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="relative flex items-center justify-center w-72 h-72">
                            <div className="absolute inset-0 bg-green-500/5 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]" />
                            <div className="absolute inset-8 bg-green-500/5 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite] delay-1000" />
                            <div className="relative w-full h-full glass rounded-full flex flex-col items-center justify-center border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-3xl bg-white/40">
                                <h2 className="text-2xl font-bold text-slate-800 tracking-tight text-center px-6 leading-tight">
                                    Service<br />in progress
                                </h2>
                            </div>
                        </div>
                    </div>
                    <div className="flex-shrink-0 w-full pb-8">
                        <Button
                            onClick={handleCompletion}
                            disabled={isCompleting}
                            size="lg"
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-16 text-lg font-bold shadow-xl shadow-slate-200/50 transform transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                        >
                            {isCompleting ? "Completing..." : "Complete Session"}
                        </Button>
                    </div>
                </div>
            );
        }
    }

    // P3/P4: Pending / En Route (state == 'pending' or fallback)
    return (
        <div className="flex-1 flex flex-col justify-center items-center gap-8 px-6 animate-in fade-in duration-700">
            <div className="text-center relative">
                {isApproaching && (
                    <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full animate-pulse z-0 scale-150"></div>
                )}
                <h2 className={`relative z-10 text-4xl font-black leading-[1.1] tracking-tight transition-all duration-500 ${isApproaching ? 'text-black animate-pulse' : 'text-slate-700'}`}>
                    {isApproaching ? (
                        "Client approaching"
                    ) : (
                        "Client is on his way"
                    )}
                </h2>
            </div>

            <div
                onClick={() => handleStartService()} // Manual Trigger for Demo
                className="flex flex-col items-center justify-center cursor-pointer group relative z-10"
            >
                <div className={`text-[120px] leading-none font-black tracking-tighter transition-all duration-500 ${isApproaching ? 'text-black scale-110' : 'text-slate-700 scale-100'}`}>
                    {eta}<span className={`text-4xl align-top ml-2 font-bold ${isApproaching ? 'text-black' : 'text-slate-700'}`}>min</span>
                </div>
            </div>
        </div>
    );
}
