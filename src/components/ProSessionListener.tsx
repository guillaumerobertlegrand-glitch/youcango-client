"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ProSessionListener() {
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        console.log("[ProSessionListener] Mounting and subscribing...");

        // Listen for NEW sessions (Booking Request)
        const channel = supabase
            .channel('pro-bookings')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sessions',
                    filter: 'state=eq.locking'
                },
                (payload: any) => {
                    console.log("[ProSessionListener] New Session Detected! 🚨", payload);
                    const sessionId = payload.new?.id;
                    if (sessionId) {
                        router.push(`/pro/incoming-request?session_id=${sessionId}`);
                    }
                }
            )
            .subscribe((status) => {
                console.log("[ProSessionListener] Subscription Status:", status);
            });

        return () => {
            console.log("[ProSessionListener] Unsubscribing");
            supabase.removeChannel(channel);
        };
    }, [router, supabase]);

    return null; // Headless component
}
