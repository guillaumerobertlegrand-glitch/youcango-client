"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings, X } from "lucide-react";

export default function ClientCompletionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');

    const [timeLeft, setTimeLeft] = useState(5.0);
    const [rewardVisible, setRewardVisible] = useState(true);
    const TOTAL_TIME = 5.0;

    // Hardcoded demo amount (or fetch if needed, but keeping it simple for effect)
    const AMOUNT = "28,00 €";

    useEffect(() => {
        // Reward pill fade out
        const rewardTimer = setTimeout(() => {
            setRewardVisible(false);
        }, 2500);

        // Countdown & Redirect
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 0.1) {
                    clearInterval(interval);
                    router.push('/'); // Silent return to C1
                    return 0;
                }
                return prev - 0.05; // 20fps update
            });
        }, 50);

        return () => {
            clearTimeout(rewardTimer);
            clearInterval(interval);
        };
    }, [router]);

    const handleCancel = () => {
        // In a real app, this would trigger a dispute/cancel RPC
        console.log("Payment Cancelled by user");
        router.push('/');
    };

    const progressPercentage = (timeLeft / TOTAL_TIME) * 100;

    return (
        <main className="flex flex-col h-screen bg-white max-w-md mx-auto relative overflow-hidden font-sans">
            {/* Header */}
            <header className="flex-shrink-0 z-50 px-6 pt-12 pb-4 flex items-center justify-between">
                <h1 className="text-2xl font-black tracking-tighter text-slate-900 cursor-default">
                    YouCanGo
                </h1>
                <Button variant="ghost" size="icon" className="text-slate-900 hover:bg-slate-100 transition-colors">
                    <Settings size={28} className="stroke-[2.5px]" />
                </Button>
            </header>

            <div className="flex-1 flex flex-col justify-center px-6 relative">

                {/* Reward Pill - Ephemeral */}
                <div className={`transition-opacity duration-1000 mb-8 absolute top-[20%] left-6 ${rewardVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-green-100 text-green-700 font-bold px-4 py-2 rounded-full text-sm inline-block shadow-sm">
                        New reward added
                    </div>

                </div>

                {/* Amount with Progress Bar Background */}
                <div className="relative w-full h-24 bg-slate-100 rounded-full overflow-hidden mb-4 border border-slate-200">

                    <div
                        className="absolute inset-y-0 left-0 bg-slate-200 transition-all duration-[50ms] ease-linear origin-left"
                        style={{ width: `${progressPercentage}%` }}
                    />

                    {/* Amount Text (Centered on top) */}
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <span className="text-4xl font-black text-slate-800 tracking-tighter">
                            {AMOUNT}
                        </span>
                    </div>
                </div>

                <div className="flex justify-between items-start mb-12 px-2">
                    <div className="flex-1" />

                    {/* Cancel Button (Red X) */}
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={handleCancel}
                            className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all active:scale-95"
                        >
                            <X size={28} strokeWidth={3} />
                        </button>
                        <span className="text-blue-400 text-xs font-medium">Cancel payment</span>
                    </div>
                </div>

            </div>
        </main>
    );
}
