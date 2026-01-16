"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SetupPasswordPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'form' | 'success'>('form');

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Listen for Auth State Changes (Handles Hash Parsing automatically)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth Event:", event, session?.user?.email);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || session) {
                setLoading(false);
            }
        });

        // Manual Hash Parsing (Fallback for some environments/browsers)
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1)); // remove #
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');

            if (access_token && refresh_token) {
                console.log("Manual Hash Detected. Setting session...");
                supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
                    if (!error) setLoading(false);
                    else console.error("Manual SetSession Error:", error);
                });
            }
        } else {
            // Fallback check if no hash
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) setLoading(false);
            });
        }

        // Safety Timeout (5s)
        const timer = setTimeout(() => {
            setLoading((l) => {
                if (l) console.warn("Safety Timeout: forcing loading stop");
                return false;
            });
        }, 5000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, [supabase, router]);

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

    if (loading) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="animate-spin" /></div>;

    if (status === 'success') {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 p-6">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                    <h1 className="text-2xl font-bold text-gray-800">Compte prêt !</h1>
                    <p className="text-gray-600">
                        Votre mot de passe est défini. Vous pouvez maintenant utiliser YouCanGo Pro.
                    </p>
                    <Button onClick={() => router.push("/onboardingpro")} className="w-full">
                        Accéder à mon espace
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 p-6">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-800">Dernière étape</h1>
                    <p className="text-gray-600">Définissez votre mot de passe pour sécuriser votre compte.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Mot de passe</label>
                        <input
                            type="password"
                            className="border p-2 rounded w-full"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="********"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Confirmer</label>
                        <input
                            type="password"
                            className="border p-2 rounded w-full"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="********"
                        />
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <Button onClick={handleSubmit} className="w-full" size="lg" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin mr-2" /> : "Valider mon compte"}
                </Button>
            </div>
        </div>
    );
}
