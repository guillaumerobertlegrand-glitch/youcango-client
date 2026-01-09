"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// Mock Data for the Request (Fallback)
const DEFAULT_REQUEST = {
    customerStatus: "Customer is ready",
    serviceTitle: "Service requested",
    serviceType: "Service",
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
    const [requestData, setRequestData] = useState(DEFAULT_REQUEST);

    const [isMerchant, setIsMerchant] = useState(false);

    // Fetch Session Details
    useEffect(() => {
        if (!sessionId) return;

        const fetchSession = async () => {
            const { data, error } = await supabase
                .from('sessions')
                .select('service_requested, estimated_arrival_duration, monetization_model')
                .eq('id', sessionId)
                .single();

            if (data?.service_requested) {
                // Use DB Duration or fallback to "Unknown"
                const realDuration = data.estimated_arrival_duration ? `${data.estimated_arrival_duration} min` : "12 min";

                setRequestData(prev => ({
                    ...prev,
                    serviceTitle: data.service_requested, // No more "requested" suffix
                    serviceType: data.service_requested,
                    eta: realDuration // Update ETA with real duration
                }));

                if (data.monetization_model === 'subscription') {
                    setIsMerchant(true);
                }
            }
        };

        fetchSession();
    }, [sessionId]);

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
            // Still redirect to dashboard if no ID, so user isn't stuck
            router.push("/pro");
            return;
        }

        const { data, error } = await supabase.rpc('api_v1_accept_session', {
            p_session_id: sessionId
        });

        if (error) {
            console.error("Accept Error:", error);
            // alert("Error accepting session: " + error.message);
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

    // MERCHAT FLOW (P3M) - STRICTLY SEPARATED COPY
    if (isMerchant) {
        return (
            <div className="flex flex-col min-h-full w-full relative"> {/* Removed px-4, use min-h-full */}

                {/* Top Spacer */}
                <div className="flex-1" />

                {/* Main Content Wrapper (Centered) */}
                <div className="w-full flex flex-col items-center justify-center space-y-4 px-4 pt-4 pb-32"> {/* Added padding to content */}

                    {/* Main Request Card (Reduced Height, Responsive) - Unified Color (#E9E9EB) */}
                    <div className="w-full bg-[#E9E9EB] backdrop-blur-sm border-0 shadow-sm rounded-[24px] overflow-hidden min-h-[160px] flex items-center justify-center relative group animate-in zoom-in-95 duration-500 p-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-semibold text-slate-900 leading-snug">
                                {requestData.serviceTitle}
                            </h2>
                        </div>
                    </div>

                    {/* Details (Restored ETA) */}
                    <div className="w-full space-y-1 text-right animate-in fade-in slide-in-from-bottom duration-700 delay-200 px-2">
                        <div className="text-sm font-medium text-slate-800">
                            Estimated service - {requestData.duration}
                        </div>
                        <div className="text-sm font-normal text-slate-900">
                            Arrival in {requestData.eta}
                        </div>
                    </div>

                </div>

                {/* Bottom Spacer */}
                <div className="flex-1" />

                {/* Sticky Footer Wrapper (Contains Button + Pill) */}
                <div className="sticky bottom-0 z-50 w-full">
                    {/* SMS Bubble Pill (Floating above Bottom Bar) */}
                    <div className="absolute bottom-full left-4 mb-6 bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm animate-in fade-in slide-in-from-left duration-500 max-w-[65%]">
                        <span className="font-normal text-slate-900 text-sm leading-snug">
                            {requestData.customerStatus}
                        </span>
                    </div>

                    {/* Decline Button (Client Style: Flush Bottom) */}
                    <div className="relative w-full shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                        <Button
                            onClick={handleDecline}
                            variant="ghost"
                            className="relative w-full rounded-none border-0 bg-white text-slate-900 font-bold text-lg h-[calc(env(safe-area-inset-bottom)+60px)] pb-[env(safe-area-inset-bottom)] hover:bg-slate-50 transition-all overflow-hidden p-0"
                        >
                            {/* Progress Background (Emptying) - Matches C2 Style */}
                            <div
                                className="absolute inset-y-0 left-0 bg-slate-200 transition-[width] duration-100 ease-linear"
                                style={{ width: `${progress}%` }}
                            />

                            {/* Content */}
                            <div className="flex items-center justify-center w-full relative z-10 px-8 h-[60px]">
                                <span className="font-medium text-lg text-slate-900">Decline?</span>
                            </div>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // SERVICE FLOW (P3) - PRESERVED EXISTING UI (Updated with Client Style Button)
    return (
        <div className="flex flex-col min-h-full w-full relative"> {/* Removed global padding usage */}

            {/* Top Spacer */}
            <div className="flex-1" />

            {/* Main Content Wrapper (Centered) */}
            <div className="w-full flex flex-col items-center justify-center space-y-4 px-4 pt-4 pb-32"> {/* Added padding & spacer */}

                {/* Main Request Card (Reduced Height, Responsive) - Unified Color (#E9E9EB) */}
                <div className="w-full bg-[#E9E9EB] backdrop-blur-sm border-0 shadow-sm rounded-[24px] overflow-hidden min-h-[160px] flex items-center justify-center relative group animate-in zoom-in-95 duration-500 p-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold text-slate-900 leading-snug">
                            {requestData.serviceTitle}
                        </h2>
                    </div>
                </div>

                {/* Details (Restored ETA) */}
                <div className="w-full space-y-1 text-right animate-in fade-in slide-in-from-bottom duration-700 delay-200 px-2 pb-4">
                    <div className="text-sm font-medium text-slate-800">
                        Estimated service - {requestData.duration}
                    </div>
                    <div className="text-sm font-normal text-slate-900">
                        Arrival in {requestData.eta}
                    </div>
                </div>

            </div>

            {/* Bottom Spacer */}
            <div className="flex-1" />

            {/* Sticky Footer Wrapper (Contains Button + Pill) */}
            <div className="sticky bottom-0 z-50 w-full">
                {/* SMS Bubble Pill (Popped up above button) */}
                <div className="absolute bottom-full left-4 mb-6 bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm animate-in fade-in slide-in-from-left duration-500 max-w-[65%]">
                    <span className="font-normal text-slate-900 text-sm leading-snug">
                        {requestData.customerStatus}
                    </span>
                </div>

                {/* Decline Button (Client Style: Flush Bottom) */}
                <div className="relative w-full shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                    <Button
                        onClick={handleDecline}
                        variant="ghost"
                        className="relative w-full rounded-none border-0 bg-white text-slate-900 font-bold text-lg h-[calc(env(safe-area-inset-bottom)+60px)] pb-[env(safe-area-inset-bottom)] hover:bg-slate-50 transition-all overflow-hidden p-0"
                    >
                        {/* Progress Background (Emptying) - Matches C2 Style */}
                        <div
                            className="absolute inset-y-0 left-0 bg-slate-200 transition-[width] duration-100 ease-linear"
                            style={{ width: `${progress}%` }}
                        />

                        {/* Content */}
                        <div className="flex items-center justify-center w-full relative z-10 px-8 h-[60px]">
                            <span className="font-medium text-lg text-slate-900">Decline?</span>
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    );
}
