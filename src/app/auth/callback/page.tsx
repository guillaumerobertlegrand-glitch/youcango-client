"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthCallbackPage() {
    const supabase = createClient();
    const router = useRouter();
    const [msg, setMsg] = useState("Connexion en cours...");
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        let mounted = true;

        const forward = () => {
            console.log("FORWARDING TO SETUP-PASSWORD");
            window.location.href = "/onboardingpro/setup-password";
        };

        const handleAuth = async () => {
            // 1. Manual Hash Parsing (Implicit Flow)
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
                console.log("HASH TOKENS FOUND. SETTING SESSION...");
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });

                if (!error) {
                    forward();
                    return;
                } else {
                    console.error("SetSession Error:", error);
                }
            }

            // 2. Check Existing Session
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log("EXISTING SESSION FOUND.");
                forward();
                return;
            }

            // 3. Fallback / Wait for auto-detection
            // Supabase client might still be processing the hash in background
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    forward();
                }
            });

            return () => subscription.unsubscribe();
        };

        handleAuth();

        // 4. Manual Failover
        const timer = setTimeout(() => {
            if (mounted) setShowButton(true);
        }, 1000);

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, [supabase, router]);

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-[#F5F5F7] font-sans p-4">
            <Loader2 className="animate-spin text-[#007AFF] w-10 h-10 mb-4" />
            <p className="text-[#1d1d1f] font-medium text-lg animate-pulse mb-6">{msg}</p>

            {showButton && (
                <div className="animate-in fade-in zoom-in duration-300">
                    <Button
                        onClick={() => window.location.href = "/onboardingpro/setup-password"}
                        className="bg-[#007AFF] hover:bg-[#0071EB] text-white font-medium"
                    >
                        Cliquez ici pour continuer
                    </Button>
                </div>
            )}
        </div>
    );
}
