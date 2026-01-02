"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import IntentCapture from "@/components/IntentCapture";
import MapWrapper from "@/components/MapWrapper";
import { Zap, Settings, Plus, Mic, AudioLines, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";

interface ClientHomeProps {
    initialStores: any[];
    userEmail?: string | null;
}

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'system';
}

export default function ClientHome({ initialStores, userEmail }: ClientHomeProps) {
    const [step, setStep] = useState<'C1' | 'C2'>('C1');
    const [intentData, setIntentData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGuiding, setIsGuiding] = useState(false);
    const [isLocking, setIsLocking] = useState(false);
    const [lockProgress, setLockProgress] = useState(100);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");

    // C4 Polish: Selected store and route info data
    const [selectedStore, setSelectedStore] = useState<any>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

    const mapRef = useRef<any>(null);
    const supabase = createClient();

    const handleIntentCaptured = (data: any) => {
        setIntentData(data);
        setStep('C2');
    };

    const handleLoadingChange = useCallback((loading: boolean) => {
        setIsLoading(loading);
    }, []);

    const handleBackToC1 = () => {
        setStep('C1');
        setIntentData(null);
        setIsGuiding(false);
        setMessages([]);
        setSelectedStore(null);
        setRouteInfo(null);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userText = inputValue;
        const newMessage: Message = {
            id: Date.now().toString(),
            text: userText,
            sender: 'user'
        };

        setMessages(prev => [...prev, newMessage]);
        setInputValue("");
        setIsLoading(true);

        const { data, error } = await supabase.functions.invoke('interpret-intent', {
            body: { text: userText }
        });

        if (data?.result) {
            handleIntentCaptured(data.result);
            setIsLoading(false);
        } else {
            console.error("AI Error:", error);
            handleIntentCaptured({ category: 'merchant', keywords: [userText], intent_summary: userText });
            setIsLoading(false);
        }
    };

    return (
        <main className="flex flex-col h-screen bg-white max-w-md mx-auto relative overflow-hidden font-sans">
            <header className="flex items-center justify-between px-6 py-4 bg-white z-50">
                <h1
                    className="text-2xl font-black tracking-tighter text-slate-900 cursor-pointer"
                    onClick={handleBackToC1}
                >
                    YouCanGo
                </h1>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900 transition-colors">
                    <Settings size={22} />
                </Button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-4">
                {step === 'C1' && (
                    <div className="h-full flex flex-col justify-end min-h-[40vh]">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                                <div className={`px-5 py-2.5 rounded-2xl max-w-[85%] text-sm font-bold shadow-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {step === 'C2' && (
                    <div className="w-full flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom duration-700">
                        <div className={`w-full overflow-hidden rounded-[32px] border border-slate-100 shadow-2xl transition-all duration-500 bg-slate-50 relative h-[65vh]`}>
                            <MapWrapper
                                ref={mapRef}
                                intentData={intentData}
                                onLoadingChange={handleLoadingChange}
                                onGuidanceStateChange={setIsGuiding}
                                onLockingChange={setIsLocking}
                                onLockProgress={setLockProgress}
                                onStoreSelected={setSelectedStore}
                                onRouteInfoUpdate={setRouteInfo}
                                unifiedMode={true}
                            />

                            {isLocking && (
                                <div className="absolute inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
                                    <Button
                                        onClick={() => mapRef.current?.cancelLock()}
                                        variant="outline"
                                        className="relative w-full rounded-none border-0 border-t border-slate-100 bg-white/95 backdrop-blur-md text-slate-800 font-bold text-sm h-14 hover:bg-slate-50 transition-all shadow-none overflow-hidden group"
                                    >
                                        <div
                                            className="absolute inset-y-0 left-0 bg-blue-600/10 pointer-events-none"
                                            style={{ width: `${lockProgress}%` }}
                                        />
                                        <div className="flex items-center justify-between w-full relative z-10 px-6">
                                            <span className="text-slate-500 font-black uppercase tracking-tighter text-[10px]">Annuler l'engagement ?</span>
                                            <span className="tabular-nums font-black text-blue-600 text-lg">
                                                {Math.ceil((lockProgress / 100) * 10)}s
                                            </span>
                                        </div>
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 px-2 mt-4">
                            {/* C4 Professional Detail Card */}
                            {isGuiding && selectedStore && (
                                <Card className="w-full bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-xl animate-in slide-in-from-bottom duration-500">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-start justify-between">
                                                <h4 className="text-xl font-black text-slate-900 leading-tight tracking-tight max-w-[70%]">
                                                    {selectedStore.name.split(' ')[0]} expects you — <span className="text-blue-600">{routeInfo ? `${Math.ceil(routeInfo.duration / 60)} min` : '5 min'}</span>
                                                    <div className="text-sm font-bold text-slate-400 mt-1">{routeInfo ? (routeInfo.distance > 1000 ? `${(routeInfo.distance / 1000).toFixed(1)} km` : `${Math.round(routeInfo.distance)} m`) : '850m'} left</div>
                                                </h4>
                                                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-slate-50 bg-slate-100 flex-shrink-0 shadow-sm">
                                                    <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200" alt="Merchant" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${selectedStore.name}&background=6366f1&color=fff&bold=true`; }} />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-lg font-black text-slate-900 truncate tracking-tight">{selectedStore.name}</h3>
                                                    <p className="text-sm text-slate-500 font-bold truncate opacity-80">{selectedStore.address}</p>
                                                </div>
                                                <Button
                                                    onClick={() => mapRef.current?.handleArrival()}
                                                    className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 flex items-center justify-center p-0 transition-all hover:scale-105 active:scale-95"
                                                >
                                                    <Zap size={24} fill="white" className="text-white" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {messages.map((msg) => (
                                <div key={msg.id} className="flex justify-end">
                                    <div className="px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-bold rounded-br-none shadow-sm">
                                        {msg.text}
                                    </div>
                                </div>
                            ))}

                            {!isLoading && !isGuiding && (
                                <div className="flex justify-start animate-in fade-in slide-in-from-left duration-500 delay-300">
                                    <div className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-800 text-sm font-bold rounded-bl-none shadow-sm capitalize">
                                        {(intentData?.extracted_category || intentData?.category || 'Recherche').replace('_', ' ')} - available now
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {!isGuiding && !isLocking && (
                <div className="absolute bottom-8 left-0 right-0 px-4 z-50">
                    <form
                        onSubmit={handleSendMessage}
                        className="bg-white border border-slate-200 rounded-full flex items-center p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
                    >
                        <Button type="button" variant="ghost" size="icon" className="rounded-full text-slate-400 h-10 w-10">
                            <Plus size={20} />
                        </Button>

                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="What do you need?"
                            className="flex-1 bg-transparent px-3 py-2 text-slate-800 focus:outline-none placeholder:text-slate-400 font-bold text-sm"
                        />

                        <div className="flex items-center gap-1">
                            {inputValue ? (
                                <Button type="submit" size="icon" className="rounded-full bg-blue-600 text-white h-10 w-10 hover:bg-blue-700">
                                    <Send size={18} />
                                </Button>
                            ) : (
                                <>
                                    <Button variant="ghost" size="icon" className="rounded-full text-slate-400 h-10 w-10">
                                        <Mic size={20} />
                                    </Button>
                                    <div className="h-10 w-10 bg-slate-900 rounded-full flex items-center justify-center text-white cursor-pointer transition-transform hover:scale-105 active:scale-95">
                                        <AudioLines size={20} />
                                    </div>
                                </>
                            )}
                        </div>
                    </form>
                </div>
            )}

            <div className="absolute inset-0 -z-10 opacity-20 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-50 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-slate-100 rounded-full blur-[100px]" />
            </div>
        </main>
    );
}
