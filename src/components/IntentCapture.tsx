"use client";

import { useState } from "react";
import { Plus, Mic, AudioLines, Settings, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'system';
}

interface IntentCaptureProps {
    onIntentCaptured: (intentData: any) => void;
}

export default function IntentCapture({ onIntentCaptured }: IntentCaptureProps) {
    const [inputValue, setInputValue] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const supabase = createClient();

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isInterpreting) return;

        const userText = inputValue;
        const newMessage: Message = {
            id: Date.now().toString(),
            text: userText,
            sender: 'user'
        };

        setMessages(prev => [...prev, newMessage]);
        setInputValue("");
        setIsInterpreting(true);

        const { data, error } = await supabase.functions.invoke('interpret-intent', {
            body: { text: userText }
        });

        if (data?.result) {
            setTimeout(() => {
                onIntentCaptured(data.result);
                setIsInterpreting(false);
            }, 800);
        } else {
            console.error("AI Error:", error || "Unknown error");
            setIsInterpreting(false);
            // Fallback: transition anyway or show error
            onIntentCaptured({ category: 'merchant', keywords: [userText], intent_summary: userText });
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto relative overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 bg-transparent">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 italic">YouCanGo</h1>
                <Button variant="ghost" size="icon" className="text-slate-600">
                    <Settings size={22} />
                </Button>
            </header>

            {/* Conversation Area (Pills) */}
            <div className="flex-1 px-4 py-6 overflow-y-auto space-y-4 flex flex-col justify-end pb-32">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`
                            px-4 py-2 rounded-2xl max-w-[80%] text-sm font-medium
                            ${msg.sender === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-slate-200 text-slate-800 rounded-bl-none'}
                         shadow-sm`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="absolute bottom-6 left-0 right-0 px-4">
                <form
                    onSubmit={handleSubmit}
                    className="bg-white border border-slate-200 rounded-full flex items-center p-1.5 shadow-lg"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-slate-400 hover:text-slate-600 h-10 w-10 flex-shrink-0"
                    >
                        <Plus size={20} />
                    </Button>

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="What do you need?"
                        className="flex-1 bg-transparent px-2 py-2 text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium"
                    />

                    <div className="flex items-center gap-1">
                        {inputValue ? (
                            <Button
                                type="submit"
                                size="icon"
                                className="rounded-full bg-blue-600 text-white h-10 w-10 hover:bg-blue-700 transition-all scale-100 animate-in zoom-in"
                            >
                                <Send size={18} />
                            </Button>
                        ) : (
                            <>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full text-slate-400 hover:text-slate-600 h-10 w-10"
                                >
                                    <Mic size={20} />
                                </Button>
                                <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-slate-800 transition-colors">
                                    <AudioLines size={20} />
                                </div>
                            </>
                        )}
                    </div>
                </form>
            </div>

            {/* Decorative Background */}
            <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-100 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-slate-200 rounded-full blur-[100px]" />
            </div>
        </div>
    );
}
