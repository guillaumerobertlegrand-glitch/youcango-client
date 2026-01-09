"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import IntentCapture from "@/components/IntentCapture";
import MapWrapper from "@/components/MapWrapper";
import { Zap, Settings, Plus, Mic, AudioLines, Send, ArrowRight, Navigation } from "lucide-react";
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
    const [messages, setMessages] = useState<Message[]>([
        { id: 'init', text: "Hi! What do you need?", sender: 'system' }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isFadingOut, setIsFadingOut] = useState(false); // New state for fade animation
    // Overlay State (C5/C6 Clean Mode)
    const [isOverlayVisible, setIsOverlayVisible] = useState(false);

    // C4 Polish: Selected store and route info data
    const [selectedStore, setSelectedStore] = useState<any>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [simProgress, setSimProgress] = useState(0);

    const mapRef = useRef<any>(null);
    const supabase = createClient();

    const handleIntentCaptured = (data: any, userText?: string) => {
        console.log("[ClientHome] handleIntentCaptured triggered. UserText:", userText, "Data:", data);
        if (userText) {
            setMessages(prev => [{
                id: Date.now().toString(),
                text: userText,
                sender: 'user'
            }]);
        }

        // --- DELAYED REQUEST FEEDBACK FLOW ---
        if (data.intent_mode === 'delayed') {
            // 1. Show Confirmation
            setMessages(prev => [...prev, {
                id: 'system-confirm',
                text: "Noted. I'll make sure to remind you at the right time.",
                sender: 'system'
            }]);

            // 2. Wait 5 seconds, then Fade Out
            setTimeout(() => {
                setIsFadingOut(true);

                // 3. Wait 3 seconds (fade), then Reset
                setTimeout(() => {
                    handleBackToC1();
                    setIsFadingOut(false);
                }, 3000);
            }, 5000);

            return; // STOP: Do not proceed to C2 (Map)
        }

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
        setMessages([
            { id: 'init', text: "Hi! What do you need?", sender: 'system' }
        ]);
        setSelectedStore(null);
        setRouteInfo(null);
        setIsOverlayVisible(false); // Reset overlay
        setActiveSession(null);
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
            handleIntentCaptured(data.result, userText);
            setIsLoading(false);
        } else {
            console.error("AI Error:", error);
            handleIntentCaptured({ category: 'merchant', keywords: [userText], intent_summary: userText }, userText);
            setIsLoading(false);
        }
    };

    // Debugging C4 Visibility
    useEffect(() => {
        console.log("ClientHome State Dump:", {
            selectedStore: !!selectedStore,
            isLocking,
            isOverlayVisible,
            activeSession: !!activeSession,
            isGuiding
        });
    }, [selectedStore, isLocking, isOverlayVisible, activeSession, isGuiding]);

    return (
        <main className="flex flex-col h-screen bg-white max-w-md mx-auto relative overflow-hidden font-sans">
            {/* Native-like Status Bar / Header (Relative - No Overlay) */}
            {!isOverlayVisible && (
                <header className="flex-shrink-0 z-50 px-6 pt-12 pb-4 glass flex items-center justify-between relative">
                    <h1
                        className="text-2xl font-black tracking-tighter text-slate-900 cursor-pointer"
                        onClick={handleBackToC1}
                    >
                        YouCanGo
                    </h1>
                    <Button variant="ghost" size="icon" className="text-slate-900 hover:bg-slate-100 transition-colors">
                        <Settings size={34} className="stroke-[2.5px]" />
                    </Button>
                </header>
            )}

            {/* Map Area - Full Screen - Interactive */}
            <div className="flex-1 relative w-full h-full">
                {step === 'C1' ? (
                    <div className={`h-full w-full transition-opacity duration-[3000ms] ease-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
                        <IntentCapture
                            messages={messages}
                            inputValue={inputValue}
                            onInputChange={setInputValue}
                            onSubmit={handleSendMessage}
                            isInterpreting={isLoading}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col h-full w-full">
                        {/* MapWrapper - Fixed Height (Upper Part) */}
                        <div className="h-[55vh] flex-shrink-0 relative w-full border-b border-slate-200">
                            <MapWrapper
                                ref={mapRef}
                                intentData={intentData}
                                onLoadingChange={handleLoadingChange}
                                onGuidanceStateChange={setIsGuiding}
                                onLockingChange={setIsLocking}
                                onLockProgress={setLockProgress}
                                onStoreSelected={setSelectedStore}
                                onRouteInfoUpdate={setRouteInfo}
                                onOverlayStateChange={setIsOverlayVisible}
                                onSessionUpdate={setActiveSession}
                                onSimulationProgress={setSimProgress}
                                unifiedMode={true}
                            />
                        </div>

                        {/* Message Stream OR Pro Reveal Card (Bottom Part) */}
                        {(!activeSession || isLocking) ? (
                            !isOverlayVisible && (
                                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] space-y-3 relative z-20">
                                    {messages.map((msg) => (
                                        <div key={msg.id} className="flex justify-start">
                                            <div className={`
                                            px-4 py-2 rounded-2xl max-w-[90%] text-sm font-medium shadow-sm
                                            ${msg.sender === 'user'
                                                    ? 'bg-blue-600 text-white rounded-br-none ml-auto'
                                                    : 'bg-slate-100 text-slate-800 rounded-bl-none'}
                                        `}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}

                                    {!isLoading && !isGuiding && (
                                        <div className="flex justify-start animate-in fade-in slide-in-from-left duration-500">
                                            <div className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-800 text-sm font-medium rounded-bl-none shadow-sm capitalize flex items-center gap-2">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                </span>
                                                {(intentData?.extracted_category || intentData?.category || 'Searching...').replace('_', ' ')} - available now
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            /* C4 Pro Reveal Card (Embedded) */
                            <div className="flex-1 bg-slate-50 relative z-20 p-6 animate-in slide-in-from-bottom duration-500 flex flex-col justify-start">
                                <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                                    {/* Pro Info Header */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="flex items-center gap-4">
                                            {/* Avatar (Pro Photo) */}
                                            <div className="h-16 w-16 rounded-full bg-slate-200 shadow-sm border-2 border-white relative overflow-hidden flex-shrink-0">
                                                {selectedStore?.image_url ? (
                                                    <img
                                                        src={selectedStore.image_url}
                                                        alt={selectedStore.name || "Provider"}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-300">
                                                        {/* Fallback Icon if no image */}
                                                        <span className="text-2xl">🏪</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-slate-200 flex items-center justify-center text-slate-400 font-bold text-xl -z-10">
                                                    {(selectedStore?.name?.[0] || "P").toUpperCase()}
                                                </div>
                                            </div>

                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-[18px] font-bold text-slate-900 leading-tight tracking-tight capitalize">
                                                        {selectedStore?.name || 'Selected Provider'}
                                                    </h3>
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                    <span className="text-[14px] text-slate-600 font-semibold leading-snug capitalize">
                                                        {/* Role/Category or specific name if available */}
                                                        {(selectedStore?.category || selectedStore?.business_type || 'Professional').replace('_', ' ')}
                                                    </span>
                                                    <span className="text-[13px] text-slate-400 font-medium leading-snug">
                                                        {selectedStore?.address || 'Location Details'}
                                                    </span>
                                                    {selectedStore?.phone && (
                                                        <span className="text-[13px] text-blue-600 font-medium mt-1">
                                                            {selectedStore.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ETA */}
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-2xl font-black text-slate-900 tracking-tighter">
                                                {Math.max(1, Math.ceil((routeInfo?.duration ? (routeInfo.duration / 60) : 12)))}
                                                <span className="text-sm font-bold text-slate-400 ml-1">min</span>
                                            </div>
                                        </div>
                                    </div>


                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Locking State - Bottom Cancel Bar */}
            {
                isLocking && (
                    <div className="absolute bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                        <Button
                            onClick={() => mapRef.current?.cancelLock()}
                            variant="ghost"
                            className="relative w-full rounded-none border-0 bg-white text-slate-900 font-bold text-lg h-[calc(env(safe-area-inset-bottom)+60px)] pb-[env(safe-area-inset-bottom)] hover:bg-slate-50 transition-all overflow-hidden p-0"
                        >
                            {/* Progress Background (Emptying) */}
                            <div
                                className="absolute inset-y-0 left-0 bg-slate-200 transition-[width] duration-100 ease-linear"
                                style={{ width: `${lockProgress}%` }}
                            />

                            {/* Content */}
                            <div className="flex items-center justify-center w-full relative z-10 px-8 h-[60px]">
                                <span className="font-medium text-lg text-slate-900">Cancel?</span>
                            </div>
                        </Button>
                    </div>
                )
            }

            {/* Native Input Bar */}
            {
                !isGuiding && !isLocking && !isOverlayVisible && !selectedStore && !activeSession && (
                    <div className="absolute bottom-0 left-0 right-0 z-50 px-4 pb-8 pt-4 glass">
                        <form
                            onSubmit={handleSendMessage}
                            className="flex items-center gap-2"
                        >
                            <Button type="button" variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600 transition-colors w-9 h-9">
                                <Plus size={24} className="stroke-[2.5px]" />
                            </Button>

                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="What do you need?"
                                    className="w-full bg-slate-100 border-none rounded-full px-4 py-2.5 text-[16px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-400 font-medium transition-all shadow-inner"
                                />
                                {!inputValue && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-slate-400 hover:bg-white/50">
                                            <Mic size={18} />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {inputValue ? (
                                <Button type="submit" size="icon" className="rounded-full bg-blue-600 text-white w-9 h-9 hover:bg-blue-700 shadow-md animate-in zoom-in-50 duration-200">
                                    <Send size={16} className="ml-0.5" />
                                </Button>
                            ) : (
                                <div className="w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md">
                                    <AudioLines size={18} />
                                </div>
                            )}
                        </form>
                    </div>
                )
            }
            <div className="absolute inset-0 -z-10 opacity-20 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-50 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-slate-100 rounded-full blur-[100px]" />
            </div>
        </main >
    );
}
