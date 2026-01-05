"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ActiveSessionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');

    // Supabase
    const supabase = createClient();

    // Simulation State
    const [eta, setEta] = useState(12); // Start at 12 minutes
    const [statusText, setStatusText] = useState("Client is on his way");
    const [isApproaching, setIsApproaching] = useState(false);
    const [isInProgress, setIsInProgress] = useState(false);

    const handleStartService = async () => {
        if (!sessionId) return;
        console.log("Triggering Service Start (Gap)...");
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
        console.log("Triggering Completion...");

        const { data, error } = await supabase.rpc('api_v1_complete_session', {
            p_session_id: sessionId
        });

        if (error) {
            console.error("Completion Network/Server Error:", error);
            alert("Error: " + error.message);
        } else if (data && !data.success) {
            console.error("Completion Logic Error:", data.error);
            alert("Completion Failed: " + data.error);
        } else {
            router.push(`/pro/completion?session_id=${sessionId}`);
        }
    };

    useEffect(() => {
        if (isInProgress) return; // Stop timer logic if in progress

        // Accelerate time for Demo: 1 real sec = 1 simulated minute (approx)
        const timer = setInterval(() => {
            setEta((prev) => {
                const newEta = Math.max(0, prev - 1); // Decrease by 1 min every tick

                // State Transition P3 -> P4
                if (newEta <= 5 && newEta > 0 && !isApproaching) {
                    setIsApproaching(true);
                    setStatusText("Client approaching");
                }
                // State Transition P4 -> P5 (Auto-Trigger)
                else if (newEta === 0) {
                    handleStartService();
                    clearInterval(timer);
                }

                return newEta;
            });
        }, 3000); // 3 seconds = 1 minute

        return () => clearInterval(timer);
    }, [isApproaching, isInProgress]);

    const handleSettings = () => {
        router.push("/pro");
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden">
            {/* Header */}
            <header className="px-6 py-6 flex flex-col z-10">
                <div className="flex items-center justify-between w-full">
                    <h1 className="text-2xl font-black tracking-tight">YouCanGo</h1>
                    <Button variant="ghost" size="icon" className="text-slate-900" onClick={handleSettings}>
                        <Settings size={24} />
                    </Button>
                </div>
                {sessionId && (
                    <div className="text-[10px] bg-slate-200 text-slate-500 px-2 py-1 rounded inline-block self-start mt-2 font-mono">
                        ID: {sessionId.slice(0, 8)}...
                    </div>
                )}
            </header>

            <main className="flex-1 flex flex-col px-6 pt-12 pb-6 w-full max-w-md mx-auto items-center">

                {/* Status Box - P3/P4/P5 */}
                {isInProgress ? (
                    <div className="w-full flex-1 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="w-full aspect-square bg-white rounded-[32px] flex flex-col items-center justify-center p-6 text-center shadow-xl border border-slate-100 relative overflow-hidden mb-8">
                            {/* Pulse Effect */}
                            <div className="absolute inset-0 bg-green-50 opacity-50 animate-pulse"></div>

                            <h2 className="text-3xl font-black text-slate-800 leading-tight mb-4 relative z-10">
                                Haircut in progress
                            </h2>
                            <div className="inline-block bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider relative z-10 mb-8">
                                P5 State
                            </div>
                            <p className="text-sm text-slate-400 max-w-[200px] relative z-10">
                                Focus on the service. The app will handle the rest.
                            </p>
                        </div>

                        <Button
                            onClick={handleCompletion}
                            size="lg"
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-16 text-lg font-bold shadow-2xl shadow-slate-300 transform transition-all active:scale-95"
                        >
                            Complete Session
                        </Button>
                    </div>
                ) : (
                    <div
                        onClick={() => handleStartService()} // Dev Trigger for P5
                        className={`cursor-pointer w-full aspect-square rounded-[32px] flex items-center justify-center p-6 text-center shadow-lg transition-all duration-1000 ${isApproaching
                            ? "bg-slate-200"
                            : "bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_200%] animate-pulse"
                            }`}>
                        <div>
                            <h2 className="text-3xl font-black text-slate-800 leading-tight mb-4">
                                {statusText}
                            </h2>
                            {/* Simulation Badge */}
                            <div className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                {isApproaching ? "P4 State" : "P3 State"}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">(Click to Simulate Arrival)</p>
                        </div>
                    </div>
                )}

                {/* Details (Only visible in P3/P4) */}
                {!isInProgress && (
                    <div className="w-full mt-8 space-y-4 text-right">
                        <div className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
                            Haircut - 30 min
                        </div>

                        <div className="flex justify-end items-baseline gap-2">
                            <span className="text-slate-500 font-medium">
                                {isApproaching ? "Arrival in" : "Expected arrival -"}
                            </span>
                            <span className={`text-4xl font-black tracking-tighter ${isApproaching ? "text-red-500 animate-pulse" : "text-slate-900"}`}>
                                {eta} min
                            </span>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
