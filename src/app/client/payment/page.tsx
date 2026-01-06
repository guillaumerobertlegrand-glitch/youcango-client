"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Settings, X } from "lucide-react"; // Icons for header and backspace

export default function ClientPaymentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const supabase = createClient();

    const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(8.0);
    const [rewardVisible, setRewardVisible] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const TOTAL_TIME = 8.0;

    // Initial Fetch & Realtime Subs
    useEffect(() => {
        if (!sessionId) {
            router.push('/');
            return;
        }

        let channel: any;
        let pollInterval: NodeJS.Timeout;

        const checkStatus = async () => {
            const { data: session } = await supabase
                .from('sessions')
                .select('amount, payment_status')
                .eq('id', sessionId)
                .single();

            if (session) {
                if (session.payment_status === 'paid') {
                    // Already Paid -> Redirect to C1 or C7? 
                    // If we consider C6 IS the final step, then redirect home.
                    router.push('/');
                    return true;
                }
                if (session.amount) {
                    setPaymentAmount(session.amount);
                    return true;
                }
            }
            return false;
        };

        const initRealtime = async () => {
            await checkStatus();

            channel = supabase
                .channel(`client-payment-${sessionId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'sessions',
                        filter: `id=eq.${sessionId}`
                    },
                    (payload) => {
                        console.log("[ClientPayment] Update:", payload);
                        if (payload.new.payment_status === 'paid') {
                            router.push('/');
                        } else if (payload.new.amount && !paymentAmount) {
                            setPaymentAmount(payload.new.amount);
                        }
                    }
                )
                .subscribe();
        };

        initRealtime();

        pollInterval = setInterval(checkStatus, 3000);

        return () => {
            clearInterval(pollInterval);
            if (channel) supabase.removeChannel(channel);
        };
    }, [sessionId, router, supabase, paymentAmount]);

    // Passive Validation Logic
    useEffect(() => {
        if (!paymentAmount) return; // Wait for amount

        // Reward pill fade out
        const rewardTimer = setTimeout(() => {
            setRewardVisible(false);
        }, 2500);

        // Countdown
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                const next = prev - 0.05;
                if (next <= 0) {
                    clearInterval(interval);
                    handleAutoValidation();
                    return 0;
                }
                return next;
            });
        }, 50);

        return () => {
            clearTimeout(rewardTimer);
            clearInterval(interval);
        };
    }, [paymentAmount]);

    const handleAutoValidation = async () => {
        if (!sessionId || isProcessing) return;
        setIsProcessing(true);
        console.log("Auto-validating payment...");

        const { error } = await supabase.rpc('api_v1_finalize_payment', {
            p_session_id: sessionId
        });

        if (!error) {
            console.log("Payment Finalized. Redirecting...");
            router.push('/'); // Success -> Home
        } else {
            console.error("Auto-Payment Error:", error);
            setIsProcessing(false);
        }
    };

    const handleCancel = async () => {
        if (!sessionId) return;
        console.log("Cancelling payment...");
        await supabase.rpc('api_v1_reject_payment', { p_session_id: sessionId });
        router.push('/');
    };

    const progressPercentage = (timeLeft / TOTAL_TIME) * 100;

    // Loading State
    if (!paymentAmount) {
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

                <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-700">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="h-4 w-4 bg-slate-200 rounded-full mb-3"></div>
                        <p className="text-slate-400 font-bold text-sm">Waiting for payment...</p>
                    </div>
                </div>
            </main>
        );
    }

    // Passive Validation UI
    return (
        <main className="flex flex-col h-screen bg-white max-w-md mx-auto relative overflow-hidden font-sans">
            {/* Header */}
            <header className="flex-shrink-0 z-50 px-6 pt-12 pb-4 flex items-center justify-between">
                <h1 className="text-2xl font-black tracking-tighter text-slate-900 cursor-default">
                    YouCanGo
                </h1>
                <Button variant="ghost" size="icon" className="text-slate-900 hover:bg-slate-100 transition-colors">
                    <Settings size={34} className="stroke-[2.5px]" />
                </Button>
            </header>

            <div className="flex-1 flex flex-col justify-center px-6 relative animate-in fade-in slide-in-from-bottom-4 duration-700">

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
                            {paymentAmount.toFixed(2)}€
                        </span>
                    </div>
                </div>

                <div className="flex justify-between items-start mb-12 px-2">
                    <div className="flex-1" />

                    {/* Cancel Button (Dark Grey X) */}
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={handleCancel}
                            className="h-14 w-14 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all active:scale-95"
                        >
                            <X size={28} strokeWidth={4} />
                        </button>
                        <span className="text-slate-400 text-xs font-medium">Cancel payment</span>
                    </div>
                </div>

            </div>
        </main>
    );
}
