"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// Mock Data for the Request
const REQUEST_DATA = {
    customerStatus: "Customer is ready",
    serviceTitle: "Haircut requested",
    serviceType: "Haircut",
    duration: "30 min",
    eta: "12 min"
};

const COUNTDOWN_SECONDS = 10;

export default function IncomingRequestPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const supabase = createClient();
    const [progress, setProgress] = useState(100);

    // Timer Logic - Updates progress regularly for smooth animation
    useEffect(() => {
        const updateFrequency = 100; // ms
        // Calculate how much percentage to remove per tick
        const totalTicks = (COUNTDOWN_SECONDS * 1000) / updateFrequency;
        const step = 100 / totalTicks;

        const timer = setInterval(() => {
            setProgress((prev) => {
                const newProgress = prev - step;
                if (newProgress <= 0) {
                    clearInterval(timer);
                    // Wait a tick then accept
                    setTimeout(handleAutoAccept, 100);
                    return 0;
                }
                return newProgress;
            });
        }, updateFrequency);

        return () => clearInterval(timer);
    }, []);

    const handleAutoAccept = async () => {
        console.log("Auto Accepting Session:", sessionId);

        if (!sessionId) {
            console.error("No Session ID found in URL!");
            // Still redirect to dashboard if no ID, so user isn't stuck
            router.push("/pro");
            return;
        }

        const { data, error } = await supabase.rpc('api_v1_accept_session', {
            p_session_id: sessionId
        });

        if (error) {
            console.error("Accept Error:", error);
            alert("Error accepting session: " + error.message);
        } else {
            console.log("Session Accepted:", data);
            router.push(`/pro/active-session?session_id=${sessionId}`);
        }
    };

    const handleDecline = async () => {
        if (!sessionId) {
            router.push("/pro");
            return;
        }

        const { error } = await supabase.rpc('api_v1_cancel_session', {
            p_session_id: sessionId
        });

        if (error) {
            console.error("Decline Error:", error);
            alert("Error declining: " + error.message);
        } else {
            // Success: Session cancelled. Client will be notified via Realtime.
            // Pro goes back to Dashboard.
            router.push("/pro");
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Chat Bubble Pill (Left Aligned) */}
            <div className="self-start bg-slate-200 rounded-2xl rounded-tl-none px-6 py-3 mb-8 shadow-sm animate-in fade-in slide-in-from-left duration-500">
                <span className="font-bold text-slate-700 text-sm">
                    {REQUEST_DATA.customerStatus}
                </span>
            </div>

            {/* Main Request Card */}
            <Card className="w-full bg-slate-800 border-0 shadow-2xl rounded-[32px] overflow-hidden mb-6 aspect-[4/3] flex items-center justify-center relative group animate-in zoom-in-95 duration-500">
                <div className="text-center p-6">
                    <h2 className="text-3xl font-black text-white leading-tight underline decoration-blue-500 decoration-4 underline-offset-8">
                        {REQUEST_DATA.serviceTitle}
                    </h2>
                </div>
            </Card>

            {/* Details */}
            <div className="w-full space-y-2 text-right animate-in fade-in slide-in-from-bottom duration-700 delay-200">
                <div className="text-xl font-bold text-slate-900">
                    {REQUEST_DATA.serviceType} - {REQUEST_DATA.duration}
                </div>
                <div className="text-lg font-medium text-slate-500">
                    Expected arrival - {REQUEST_DATA.eta}
                </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Decline Button with Unfilling Progress */}
            <div className="w-full relative h-16 rounded-[20px] overflow-hidden shadow-sm border border-slate-300 bg-slate-100 cursor-pointer active:scale-95 transition-all" onClick={handleDecline}>
                {/* Progress Bar Background */}
                <div
                    className="absolute left-0 top-0 bottom-0 bg-slate-300/50 transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />
                {/* Label */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                    <span className="text-slate-600 font-bold text-lg">Decline?</span>
                </div>
            </div>
        </div>
    );
}
