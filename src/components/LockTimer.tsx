'use client';

import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface LockTimerProps {
    duration: number; // in seconds
    onCancel: () => void;
    onExpire: () => void;
}

export default function LockTimer({ duration, onCancel, onExpire }: LockTimerProps) {
    const [timeLeft, setTimeLeft] = useState(duration);

    useEffect(() => {
        if (timeLeft <= 0) {
            onExpire();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, onExpire]);

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/90 backdrop-blur-md border-t shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="max-w-md mx-auto space-y-4">
                <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-stone-600">Locking Zone...</span>
                    <span className="tabular-nums">{timeLeft}s</span>
                </div>

                <div className="relative h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={onCancel}
                >
                    <X size={16} className="mr-2" />
                    Annuler l'engagement
                </Button>
            </div>
        </div>
    );
}
