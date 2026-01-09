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

    // Timer Logic - Updates progress regularly for smooth animation (Logic kept for auto-accept, visual removed)
    useEffect(() => {
        // We keep the timer for auto-accept logic if needed, or remove it entirely if user wants manual only?
        // User didn't say remove AUTO-ACCEPT. They said change UI of DECLINE.
        // Assuming Auto-Accept is still desired behavior for "Incoming Request" context (often time-boxed).
        // I will keep the logic but remove the visual progress bar state usage for the button.

        const timer = setTimeout(() => {
            // handleAutoAccept(); // Wait, usually incoming request auto-expires (Decline) or Auto-Accepts?
            // Previous code was Auto-Accepting on timeout. I'll keep that logic for now to not break flow logic.
            handleAutoAccept();
        }, COUNTDOWN_SECONDS * 1000);

        return () => clearTimeout(timer);
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
            <div className="flex flex-col h-full w-full px-4">

                {/* Top Spacer */}
                <div className="flex-1" />

                {/* Main Content Wrapper (Centered) */}
                <div className="w-full flex flex-col items-center justify-center space-y-4">

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

                <div className="w-full flex justify-between items-end mb-6">
                    {/* SMS Bubble Pill (Bottom Left) */}
                    <div className="bg-[#E9E9EB] rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm animate-in fade-in slide-in-from-left duration-500 max-w-[65%]">
                        <span className="font-normal text-slate-900 text-[15px] leading-snug">
                            {requestData.customerStatus}
                        </span>
                    </div>

                    {/* New Circular Decline Button (Bottom Right) */}
                    <div className="flex flex-col items-center gap-1 animate-in fade-in slide-in-from-right duration-500">
                        <button
                            onClick={handleDecline}
                            className="h-14 w-14 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all active:scale-95"
                        >
                            <X size={28} strokeWidth={3} />
                        </button>
                        <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">Decline</span>
                    </div>
                </div>
            </div>
        );
    }

    // SERVICE FLOW (P3) - PRESERVED EXISTING UI (Updated with Button)
    return (
        <div className="flex flex-col h-full w-full px-4">

            {/* Top Spacer */}
            <div className="flex-1" />

            {/* Main Content Wrapper (Centered) */}
            <div className="w-full flex flex-col items-center justify-center space-y-4">

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

            <div className="w-full flex justify-between items-end mb-6">
                {/* SMS Bubble Pill (Bottom Left) */}
                <div className="bg-[#E9E9EB] rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm animate-in fade-in slide-in-from-left duration-500 max-w-[65%]">
                    <span className="font-normal text-slate-900 text-[15px] leading-snug">
                        {requestData.customerStatus}
                    </span>
                </div>

                {/* New Circular Decline Button (Bottom Right) */}
                <div className="flex flex-col items-center gap-1 animate-in fade-in slide-in-from-right duration-500">
                    <button
                        onClick={handleDecline}
                        className="h-14 w-14 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all active:scale-95"
                    >
                        <X size={28} strokeWidth={3} />
                    </button>
                    <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">Decline</span>
                </div>
            </div>
        </div>
    );
}
