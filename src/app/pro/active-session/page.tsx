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

    // Initial Fetch (Synchronize ETA)
    useEffect(() => {
        if (!sessionId) return;
        const fetchSession = async () => {
            const { data } = await supabase
                .from('sessions')
                .select('estimated_arrival_duration, state')
                .eq('id', sessionId)
                .single();

            if (data?.estimated_arrival_duration) {
                // Set initial ETA from the real DB value
                setEta(data.estimated_arrival_duration);
            } else {
                setEta(12); // Fallback
            }

            if (data?.state === 'in_progress') {
                setIsInProgress(true);
            }
        };
        fetchSession();
    }, [sessionId]);

    const handleStartService = async () => {
        if (!sessionId) return;
        console.log("Triggering Service Start...");
        setIsInProgress(true); // Optimistic

        const { error } = await supabase.rpc('api_v1_start_service', {
            p_session_id: sessionId
        });

        if (error) {
            console.error("Start Service Error:", error);
        }
    };

    const handleCompletion = async () => {
        if (!sessionId) return;

        const { data, error } = await supabase.rpc('api_v1_complete_session', {
            p_session_id: sessionId
        });

        if (error) {
            alert("Error: " + error.message);
        } else if (data && !data.success) {
            alert("Completion Failed: " + data.error);
        } else {
            router.push(`/pro/completion?session_id=${sessionId}`);
        }
    };

    // Stable Interval to prevent "Zeno's Paradox" (slowing down as minutes decrease)
    const intervalRef = useRef<number | null>(null);
    const phaseRef = useRef<'P3' | 'P4'>('P3');

    useEffect(() => {
        if (isInProgress || eta === null || eta <= 0) return;

        // Determine critical interval ONLY if not set or if phase changes
        let currentPhase: 'P3' | 'P4' = eta > 5 ? 'P3' : 'P4';

        // Reset interval if phase changed
        if (currentPhase !== phaseRef.current) {
            intervalRef.current = null;
            phaseRef.current = currentPhase;
        }

        if (!intervalRef.current) {
            if (currentPhase === 'P3') {
                // P3 Travel: 20 seconds to cover (InitialETA - 5) minutes
                // We calculate the tick ONCE based on the gap at that moment.
                const P3_DURATION_MS = 20000;
                const minutesToCover = eta - 5;
                intervalRef.current = P3_DURATION_MS / Math.max(1, minutesToCover);
            } else {
                // P4 Approach: 10 seconds to cover remaining minutes (e.g. 5)
                const P4_DURATION_MS = 10000;
                intervalRef.current = P4_DURATION_MS / Math.max(1, eta);
            }
        }

        const timer = setInterval(() => {
            setEta((prev) => {
                if (prev === null) return null;
                const newEta = Math.max(0, prev - 1); // Decrease by 1 min

                if (newEta <= 5 && newEta > 0 && !isApproaching) {
                    setIsApproaching(true);
                    setStatusText("Client approaching");
                    // Force re-calc for next tick naturally via effect dependency?
                    // Actually, the effect will re-run when `eta` changes.
                    // But we want to preserve intervalRef unless phase changes.
                }
                else if (newEta === 0) {
                    handleStartService();
                    clearInterval(timer);
                }
                return newEta;
            });
        }, intervalRef.current);

        return () => clearInterval(timer);
    }, [isApproaching, isInProgress, eta]);

    return (
        <div className="flex flex-col w-full h-full relative">

            {/* Mesh Background */}
            <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-2/3 bg-gradient-to-b from-blue-50/80 to-transparent" />
                <div className="absolute top-1/4 right-0 w-64 h-64 bg-purple-50 rounded-full blur-[80px]" />
            </div>

            <div className="flex-1 flex flex-col px-6 pt-8 pb-32 z-10 w-full justify-center">
                {/* Status Box - P3/P4/P5 */}
                {isInProgress ? (
                    <div className="w-full flex-1 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="relative w-64 h-64 mb-10 flex items-center justify-center">
                            <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping duration-[3s]"></div>
                            <div className="w-56 h-56 bg-white rounded-full shadow-2xl flex flex-col items-center justify-center relative z-10 border border-green-100">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Service</span>
                                <span className="text-2xl font-black text-slate-900 tracking-tight">Active</span>
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-3 animate-pulse"></div>
                            </div>
                        </div>

                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-black text-slate-800 leading-tight mb-2">
                                In Progress
                            </h2>
                            <p className="text-slate-400 font-medium">Focus on the client.</p>
                        </div>

                        <Button
                            onClick={handleCompletion}
                            size="lg"
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-16 text-lg font-bold shadow-xl shadow-slate-200/50 transform transition-all active:scale-95"
                        >
                            Complete Session
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col justify-center items-center gap-12">

                        <div className="text-center">
                            <h2 className="text-4xl font-black text-slate-900 leading-[1.1] tracking-tight">
                                {statusText}
                            </h2>
                        </div>

                        <div
                            onClick={() => handleStartService()} // Dev Trigger
                            className="flex flex-col items-center justify-center cursor-pointer group"
                        >
                            <div className={`text-[120px] leading-none font-black tracking-tighter transition-all duration-500 ${isApproaching ? "text-slate-900 scale-110" : "text-slate-200"}`}>
                                {eta}<span className="text-4xl align-top ml-2 text-slate-300 font-bold">min</span>
                            </div>
                            <p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest group-hover:text-blue-500 transition-colors">
                                Estimated arrival
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
