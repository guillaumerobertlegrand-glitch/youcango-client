"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings, Check, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function PaymentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const supabase = createClient();

    const [amount, setAmount] = useState("0");
    const [status, setStatus] = useState<'input' | 'processing' | 'rejected_retry' | 'paid'>('input');
    const [retryCount, setRetryCount] = useState(0);

    // Listen for Realtime Updates (e.g. Client Decline or Success)
    useEffect(() => {
        if (!sessionId) return;

        const channel = supabase
            .channel('payment-status')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `id=eq.${sessionId}`
                },
                (payload) => {
                    const newStatus = payload.new.payment_status;
                    const attempts = payload.new.payment_attempts;

                    if (newStatus === 'paid') {
                        router.push('/pro'); // Or a Success Summary page
                    } else if (newStatus === 'rejected_retry') {
                        setStatus('rejected_retry');
                        setRetryCount(attempts);
                        // Reset to input mode after a brief delay or immediately?
                        // Let's keep it in "Retry" state until interaction
                    } else if (newStatus === 'failed') {
                        alert("Payment Failed: Too many retries.");
                        router.push('/pro');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId, supabase, router]);

    const handleDigit = (digit: string) => {
        if (status !== 'input' && status !== 'rejected_retry') return;

        // Clear retry error on input
        if (status === 'rejected_retry') setStatus('input');

        setAmount(prev => {
            if (prev === "0") return digit;
            if (prev.includes(",") && prev.split(",")[1].length >= 2) return prev; // Max 2 decimals
            return prev + digit;
        });
    };

    const handleComma = () => {
        if (status !== 'input' && status !== 'rejected_retry') return;
        if (status === 'rejected_retry') setStatus('input');
        if (!amount.includes(",")) setAmount(prev => prev + ",");
    };

    const handleBackspace = () => {
        if (status !== 'input' && status !== 'rejected_retry') return;
        if (status === 'rejected_retry') setStatus('input');
        setAmount(prev => {
            if (prev.length === 1) return "0";
            return prev.slice(0, -1);
        });
    };

    const handlePropose = async () => {
        if (!sessionId) return;

        setStatus('processing');
        // Parse "12,50" -> 12.50
        const numericAmount = parseFloat(amount.replace(",", "."));

        const { error } = await supabase.rpc('api_v1_propose_payment', {
            p_session_id: sessionId,
            p_amount: numericAmount
        });

        if (error) {
            console.error(error);
            setStatus('input'); // Fallback
            alert("Error sending proposal");
        }
        // If success, we wait for Realtime update (Paid or Rejected)
    };

    // Helper for "rejected_retry" message
    const getFeedbackMessage = () => {
        if (status === 'rejected_retry') {
            return `Client declined (${retryCount}/3). Verify amount.`;
        }
        if (status === 'processing') {
            return "Waiting for client confirmation...";
        }
        return "";
    };

    return (
        <div className="flex flex-col h-full">

            {/* Flexible Spacer to center Content */}
            <div className="flex-1"></div>

            {/* Amount Display - Minimal Height */}
            <div className={`w-full py-6 rounded-[32px] flex items-center justify-center text-center shadow-sm transition-colors duration-500 mb-4 ${status === 'rejected_retry' ? 'bg-red-50 border-2 border-red-200' : 'bg-white border-2 border-slate-100'}`}>
                <span className="text-4xl font-black text-slate-800 tracking-tighter">
                    {amount} <span className="text-2xl text-slate-400">€</span>
                </span>
            </div>

            {/* Feedback Message */}
            <div className="h-6 mb-8 flex items-center justify-center">
                <p className={`font-medium ${status === 'rejected_retry' ? 'text-red-500 animate-pulse' : 'text-slate-400 opacity-0'}`}>
                    {getFeedbackMessage() || "Placeholder"}
                </p>
            </div>

            {/* Keypad - Reduced Height, Full Width */}
            <div className="flex-1 grid grid-cols-3 gap-3 mb-4 content-center w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleDigit(num.toString())}
                        className="text-2xl font-bold text-slate-700 bg-white rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center h-14"
                    >
                        {num}
                    </button>
                ))}
                <button onClick={handleComma} className="text-2xl font-bold text-slate-700 bg-white rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center h-14">,</button>
                <button onClick={() => handleDigit("0")} className="text-2xl font-bold text-slate-700 bg-white rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center h-14">0</button>
                <button onClick={handleBackspace} className="text-slate-700 bg-white rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center h-14">
                    <Delete size={24} />
                </button>
            </div>

            {/* Validate Button */}
            <Button
                className={`w-full h-16 text-xl font-bold rounded-full transition-all duration-300 ${status === 'processing' ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'}`}
                onClick={handlePropose}
                disabled={status === 'processing' || amount === "0"}
            >
                {status === 'processing' ? (
                    <span className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Waiting...
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        Confirm amount <Check size={24} strokeWidth={3} />
                    </span>
                )}
            </Button>

        </div>
    );
}
