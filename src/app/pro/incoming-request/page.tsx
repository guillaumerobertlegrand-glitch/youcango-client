"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
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

    // Fetch Session Details
    useEffect(() => {
        if (!sessionId) return;

        const fetchSession = async () => {
            const { data, error } = await supabase
                .from('sessions')
                .select('service_requested, estimated_arrival_duration')
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
        <div className="flex flex-col h-full w-full px-4">

            {/* Top Spacer */}
            <div className="flex-1" />

            {/* Main Content Wrapper (Centered) */}
            <div className="w-full flex flex-col items-center justify-center space-y-4">

                {/* Main Request Card (Reduced Height, Responsive) */}
                <div className="w-full bg-slate-200/80 backdrop-blur-sm border-0 shadow-sm rounded-[24px] overflow-hidden min-h-[160px] flex items-center justify-center relative group animate-in zoom-in-95 duration-500 p-6">
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
                    <div className="text-sm font-bold text-slate-900">
                        Arrival in {requestData.eta}
                    </div>
                </div>

            </div>

            {/* Bottom Spacer */}
            <div className="flex-1" />

            {/* SMS Bubble Pill (Bottom Left) */}
            <div className="self-start bg-[#E9E9EB] rounded-2xl rounded-bl-sm px-4 py-2.5 mb-6 shadow-sm animate-in fade-in slide-in-from-left duration-500 max-w-[85%]">
                <span className="font-normal text-slate-900 text-[15px] leading-snug">
                    {requestData.customerStatus}
                </span>
            </div>

            {/* Decline Button with Unfilling Progress */}
            <div className="w-full relative h-14 rounded-[16px] overflow-hidden shadow-sm border border-slate-200 bg-white cursor-pointer active:scale-95 transition-all mb-2" onClick={handleDecline}>
                {/* Progress Bar Background */}
                <div
                    className="absolute left-0 top-0 bottom-0 bg-slate-100 transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />
                {/* Label */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                    <span className="text-slate-500 font-medium text-base">Decline</span>
                </div>
            </div>
        </div>
    );
}
