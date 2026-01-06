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

            <main className="flex-1 flex flex-col w-full h-full relative">
                {/* Mesh Background */}
                <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-2/3 bg-gradient-to-b from-blue-50/80 to-transparent" />
                    <div className="absolute top-1/4 right-0 w-64 h-64 bg-purple-50 rounded-full blur-[80px]" />
                </div>

                <div className="flex-1 flex flex-col px-6 pt-8 pb-32 z-10">
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
                                    Haircut in progress
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
                        <div className="flex-1 flex flex-col justify-between">
                            <div className="mt-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4 border border-blue-100/50">
                                    {isApproaching ? "Arrival Imminent" : "On the way"}
                                </div>
                                <h2 className="text-4xl font-black text-slate-900 leading-[1.1] tracking-tight">
                                    {statusText}
                                </h2>
                            </div>

                            <div
                                onClick={() => handleStartService()} // Dev Trigger
                                className="flex-1 flex flex-col items-center justify-center cursor-pointer group"
                            >
                                <div className={`text-[120px] leading-none font-black tracking-tighter transition-all duration-500 ${isApproaching ? "text-slate-900 scale-110" : "text-slate-200"}`}>
                                    {eta}<span className="text-4xl align-top ml-2 text-slate-300 font-bold">min</span>
                                </div>
                                <p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest group-hover:text-blue-500 transition-colors">
                                    {isApproaching ? "Tap to Start Service" : "Estimated Arrival"}
                                </p>
                            </div>

                            {sessionId && (
                                <div className="w-full bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-whiteShadow-sm">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200" />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900">Client Name</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Basic Haircut</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-slate-900">30€</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
