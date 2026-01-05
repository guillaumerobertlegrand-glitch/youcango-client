"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function ClientCompletionPage() {
    const router = useRouter();

    const handleHome = () => {
        router.push('/');
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
            <div className="h-24 w-24 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.5)] mb-8 animate-in zoom-in spin-in-12 duration-700">
                <Check size={48} className="text-white stroke-[4]" />
            </div>

            <h1 className="text-4xl font-black text-white tracking-tighter mb-4 animate-in slide-in-from-bottom-4 duration-700 delay-200">
                All done!
            </h1>
            <p className="text-slate-400 font-medium text-lg max-w-xs mx-auto mb-12 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                Your payment was successful. Enjoy your fresh look.
            </p>

            <Button
                onClick={handleHome}
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-100 rounded-2xl h-16 w-full max-w-xs font-bold text-lg shadow-xl animate-in fade-in duration-1000 delay-500"
            >
                Back to Home
            </Button>
        </div>
    );
}
