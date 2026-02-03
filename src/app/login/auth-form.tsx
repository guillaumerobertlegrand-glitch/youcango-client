"use client";

import { useState } from "react";
import { login, signup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function AuthForm() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);
        if (mode === 'login') {
            await login(formData);
        } else {
            await signup(formData);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <form action={handleSubmit} className="space-y-5">
                <div className="space-y-4">


                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        required
                        className="h-[50px] bg-[#F5F5F7] border-0 rounded-[14px] px-4 text-[17px] md:text-[17px] text-[#1d1d1f] placeholder:text-[#86868b] focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-0 transition-all font-normal"
                    />
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Mot de passe"
                        required
                        className="h-[50px] bg-[#F5F5F7] border-0 rounded-[14px] px-4 text-[17px] md:text-[17px] text-[#1d1d1f] placeholder:text-[#86868b] focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-0 transition-all font-normal"
                    />
                </div>

                <div className="flex flex-col gap-3 pt-2">
                    {mode === 'login' ? (
                        <>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-[50px] bg-[#007AFF] hover:bg-[#0071EB] text-white font-semibold text-[17px] rounded-[14px] shadow-sm transition-all active:scale-[0.98]"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Se connecter
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setMode('signup')}
                                className="w-full h-[50px] text-[#007AFF] hover:text-[#0071EB] hover:bg-[#007AFF]/5 font-medium text-[17px] rounded-[14px]"
                            >
                                Créer un compte
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-[50px] bg-[#007AFF] hover:bg-[#0071EB] text-white font-semibold text-[17px] rounded-[14px] shadow-sm transition-all active:scale-[0.98]"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                S'inscrire
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setMode('login')}
                                className="w-full h-[50px] text-[#86868b] hover:text-[#1d1d1f] hover:bg-gray-100 font-medium text-[17px] rounded-[14px]"
                            >
                                Retour à la connexion
                            </Button>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}
