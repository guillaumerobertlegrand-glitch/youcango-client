"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SetupPasswordContent() {
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'form' | 'success'>('form');

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleAuth = async () => {
            // 1. Check for 'code' (PKCE)
            const code = searchParams.get('code');
            if (code) {
                console.log("PKCE Code detected. Exchanging...");
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    console.error("Code exchange error:", error);
                    setError(error.message);
                }
                setLoading(false);
                return;
            }

            // 2. Check for Hash (Implicit) - Handled by onAuthStateChange partially, but we can force setSession if needed
            const hash = window.location.hash;
            if (hash && hash.includes('access_token')) {
                console.log("Hash detected.");
                const params = new URLSearchParams(hash.substring(1));
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');

                if (access_token && refresh_token) {
                    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                    if (error) console.error("SetSession error:", error);
                }
            }

            // 3. Check current session
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log("Session found:", session.user.email);
                setLoading(false);
            } else {
                // Wait a bit for auto-recovery (onAuthStateChange) then stop loading
                setTimeout(() => setLoading(false), 2000);
            }
        };

        handleAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || session) {
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase, searchParams]);

    const handleSubmit = async () => {
        if (password.length < 6) {
            setError("Le mot de passe doit faire au moins 6 caractères.");
            return;
        }
        if (password !== confirm) {
            setError("Les mots de passe ne correspondent pas.");
            return;
        }

        setLoading(true);
        setError(null);

        const { error: updateError } = await supabase.auth.updateUser({
            password: password
        });

        if (updateError) {
            setError(updateError.message);
            setLoading(false);
        } else {
            setStatus('success');
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex justify-center items-center bg-[#F5F5F7]">
            <Loader2 className="animate-spin text-[#007AFF] w-8 h-8" />
        </div>
    );

    if (status === 'success') {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center bg-[#F5F5F7] p-6 font-sans">
                <div className="bg-white p-10 rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] max-w-[400px] w-full text-center space-y-8 animate-in fade-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
                    </div>
                    <div>
                        <h1 className="text-[28px] font-medium text-gray-900 tracking-tight">Compte activé</h1>
                    </div>
                    <Button
                        onClick={() => router.push("/onboardingpro/welcome")}
                        className="w-full h-[50px] bg-[#007AFF] hover:bg-[#0071EB] text-white font-medium text-[17px] rounded-[14px] shadow-sm transition-all"
                    >
                        Accéder à mon espace
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-[#F5F5F7] p-6 font-sans">
            <div className="bg-white p-10 rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] max-w-[400px] w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header */}
                <div className="flex flex-col items-center space-y-4 mb-8">
                    <div className="w-16 h-16 bg-[#007AFF] rounded-[18px] flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Zap className="h-8 w-8 text-white fill-current" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-[24px] font-medium text-gray-900 tracking-tight">Créer votre mot de passe</h1>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[15px] font-medium text-gray-700 ml-1">Mot de passe</label>
                            <Input
                                type="password"
                                className="h-[50px] bg-[#F5F5F7] border-0 rounded-[14px] px-4 text-[17px] text-[#1d1d1f] placeholder:text-[#86868b] focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-0 transition-all font-normal"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Au moins 6 caractères"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[15px] font-medium text-gray-700 ml-1">Confirmer</label>
                            <Input
                                type="password"
                                className="h-[50px] bg-[#F5F5F7] border-0 rounded-[14px] px-4 text-[17px] text-[#1d1d1f] placeholder:text-[#86868b] focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-0 transition-all font-normal"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Répétez le mot de passe"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3.5 rounded-[12px] bg-red-50 text-red-600 text-[15px] font-medium text-center border border-red-100">
                            {error}
                        </div>
                    )}

                    <Button
                        onClick={handleSubmit}
                        className="w-full h-[50px] bg-[#007AFF] hover:bg-[#0071EB] text-white font-semibold text-[17px] rounded-[14px] shadow-sm transition-all"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : "Valider et Continuer"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function SetupPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex justify-center items-center bg-[#F5F5F7]"><Loader2 className="animate-spin text-[#007AFF]" /></div>}>
            <SetupPasswordContent />
        </Suspense>
    );
}
