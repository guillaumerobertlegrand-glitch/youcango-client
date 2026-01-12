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
                    event: '*',
                    schema: 'public',
                    table: 'sessions',
                },
                (payload: any) => {
                    const state = payload.new?.state;
                    const id = payload.new?.id;

                    if (id && state === 'locking') {
                        // FIX: Only redirect on NEW requests (locking).
                        // 'pending' means it was accepted, so we stay on ActiveSessionPage (P3).
                        console.log(`[ProSessionListener] New Request (locking) for session ${id}`);

                        // Avoid loop if already there
                        if (!window.location.href.includes(`incoming-request?session_id=${id}`)) {
                            router.push(`/pro/incoming-request?session_id=${id}`);
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[ProSessionListener] Subscription Status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log("[ProSessionListener] ✅ Connected to Realtime");
                } else if (status === 'CHANNEL_ERROR') {
                    console.error("[ProSessionListener] ❌ Realtime Channel Error");
                }
            });

        return () => {
            console.log("[ProSessionListener] Unsubscribing");
            supabase.removeChannel(channel);
        };
    }, [router, supabase]);

    return null;
}
