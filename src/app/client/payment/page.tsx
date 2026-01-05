"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function ClientPaymentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const supabase = createClient();

    const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
    const [paymentTimer, setPaymentTimer] = useState(5);

    // Initial Fetch & Realtime Subs
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
                    router.push(`/client/completion?session_id=${sessionId}`);
                    return true;
                }
                // Update local state if amount appears
                if (session.amount) {
                    setPaymentAmount(session.amount);
                    return true; // Found amount
                }
            }
            return false;
        };

        const initRealtime = async () => {
            // 1. Initial State Check
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
                            router.push(`/client/completion?session_id=${sessionId}`);
                        } else if (payload.new.payment_status === 'failed') {
                            alert("Payment Failed/Rejected");
                            router.push('/');
                        } else if (payload.new.amount && !paymentAmount) {
                            setPaymentAmount(payload.new.amount);
                        }
                    }
                )
                .subscribe();
        };

        initRealtime();

        // 3. Fallback Polling (3s)
        pollInterval = setInterval(() => {
            console.log("[ClientPayment] Polling...");
            checkStatus();
        }, 3000);

        return () => {
            clearInterval(pollInterval);
            if (channel) supabase.removeChannel(channel);
        };
    }, [sessionId, router, supabase, paymentAmount]);

    // Timer Logic
    useEffect(() => {
        if (!paymentAmount) return; // Don't start timer until amount shows

        const interval = setInterval(() => {
            setPaymentTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    handleAutoPay();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [paymentAmount]);

    const handleAutoPay = async () => {
        if (!sessionId) return;
        console.log("Auto-finalizing payment...");
        const { error } = await supabase.rpc('api_v1_finalize_payment', {
            p_session_id: sessionId
        });

        if (error) {
            console.error("Auto-Payment Error:", error);
            alert("Payment Processing Failed: " + error.message);
        } else {
            console.log("Auto-Payment Triggered. Waiting for Redirect...");
        }
    };

    const handleReject = async () => {
        if (!sessionId) return;
        await supabase.rpc('api_v1_reject_payment', { p_session_id: sessionId });
        router.push('/'); // Or back to service? For now home.
    };

    if (!paymentAmount) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-4 w-4 bg-slate-200 rounded-full mb-2"></div>
                    <p className="text-slate-400 font-bold text-sm">Waiting for invoice...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-100 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-sm bg-white border border-slate-100 shadow-2xl rounded-[40px] p-8 flex flex-col items-center relative overflow-hidden z-10 animate-in slide-in-from-bottom-8 duration-700">
                {/* Timer Progress Bar */}
                <div
                    className="absolute bottom-0 left-0 h-2 bg-green-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${(paymentTimer / 5) * 100}%` }}
                />

                <span className="text-sm font-black text-green-600 uppercase tracking-widest mb-6">Payment Request</span>

                <div className="text-7xl font-black text-slate-900 mb-2 tracking-tighter">
                    {paymentAmount.toFixed(2)}€
                </div>
                <p className="text-slate-400 text-base font-bold mb-10">For your hair service</p>

                <div className="flex flex-col w-full gap-4">
                    <Button
                        className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg shadow-lg"
                        disabled // It's auto
                    >
                        Processing... {paymentTimer}s
                    </Button>

                    <Button
                        variant="ghost"
                        className="w-full h-12 text-slate-400 font-bold hover:text-red-500 hover:bg-red-50 rounded-xl"
                        onClick={handleReject}
                    >
                        Reject / Dispute
                    </Button>
                </div>
            </div>
        </div>
    );
}
