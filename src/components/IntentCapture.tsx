"use client";

// useState, useEffect removed as this is a dumb component
import { Plus, Mic, AudioLines, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'system';
}

interface IntentCaptureProps {
    messages: Message[];
    inputValue: string;
    onInputChange: (value: string) => void;
    onSubmit: (e?: React.FormEvent) => void;
    isInterpreting: boolean;
}

export default function IntentCapture({
    messages,
    inputValue,
    onInputChange,
    onSubmit,
    isInterpreting
}: IntentCaptureProps) {
    // No local state

    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden">
            {/* Header Removed - Managed by ClientHome */}

            {/* Conversation Area (Pills) */}
            <div className="flex-1 px-4 py-6 overflow-y-auto min-h-0 z-10 relative">
                <div className="flex flex-col justify-end min-h-full space-y-4 pb-32">
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
                    {isInterpreting && (
                        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                            <div className="px-4 py-2 rounded-2xl text-sm font-medium bg-slate-100 text-slate-500 rounded-bl-none italic">
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input Area */}
            <div className="absolute bottom-6 left-0 right-0 px-4">
                <form
                    onSubmit={onSubmit}
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
                        onChange={(e) => onInputChange(e.target.value)}
                        placeholder="What do you need?"
                        className="flex-1 bg-transparent px-2 py-2 text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium"
                        disabled={isInterpreting}
                    />

                    <div className="flex items-center gap-1">
                        {inputValue ? (
                            <Button
                                type="submit"
                                size="icon"
                                className="rounded-full bg-blue-600 text-white h-10 w-10 hover:bg-blue-700 transition-all scale-100 animate-in zoom-in"
                                disabled={isInterpreting}
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


