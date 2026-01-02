"use client";

import { useState, useCallback } from "react";
import IntentCapture from "@/components/IntentCapture";
import MapWrapper from "@/components/MapWrapper";
import { Zap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signout } from "@/app/login/actions";

interface ClientHomeProps {
    initialStores: any[];
    userEmail?: string | null;
}

export default function ClientHome({ initialStores, userEmail }: ClientHomeProps) {
    const [step, setStep] = useState<'C1' | 'C2'>('C1');
    const [intentData, setIntentData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleIntentCaptured = (data: any) => {
        console.log("[ClientHome] Intent captured:", data);
        setIntentData(data);
        setStep('C2');
    };

    const handleLoadingChange = useCallback((loading: boolean) => {
        console.log(`[ClientHome] isLoading update: ${loading}`);
        setIsLoading(loading);
    }, []);

    const handleBackToC1 = () => {
        setIntentData(null);
        setIsLoading(false);
        setStep('C1');
    };

    if (step === 'C1') {
        return <IntentCapture onIntentCaptured={handleIntentCaptured} />;
    }

    return (
        <main className="flex min-h-screen flex-col bg-slate-50 relative overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
                <div className="flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tighter text-blue-600 cursor-pointer" onClick={handleBackToC1}>
                        <Zap className="h-6 w-6 fill-current" />
                        YouCanGo
                    </div>
                    {userEmail && (
                        <div className="flex items-center gap-2">
                            <form action={signout}>
                                <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-700">
                                    Sign Out
                                </Button>
                            </form>
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 uppercase">
                                {userEmail.substring(0, 2)}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Map Area */}
            <div className="flex-1 w-full bg-slate-900 overflow-hidden relative">
                <MapWrapper intentData={intentData} onLoadingChange={handleLoadingChange} />
            </div>

            {/* Action Bar (Dynamic for C2) */}
            <div className="absolute bottom-6 left-0 right-0 px-4 z-40">
                <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl flex items-center p-4 shadow-xl text-slate-800 animate-in slide-in-from-bottom duration-500">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                        {isLoading ? (
                            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                        ) : (
                            <Zap className="text-blue-600" size={20} />
                        )}
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-0.5">
                            {isLoading ? 'Recherche en cours...' : 'Recherche terminée'}
                        </p>
                        <p className="text-sm font-bold">"{intentData?.intent_summary || 'Chargement...'}"</p>
                    </div>
                </div>
            </div>
        </main>
    );
}
