import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "YouCanGo Pro - Connexion",
    description: "Accéder à votre espace professionnel",
};

export default function LoginLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen w-full bg-neutral-100 flex items-center justify-center font-sans">
            {/* Smartphone Frame */}
            <main className={`flex flex-col h-[850px] w-full max-w-[430px] bg-white relative shadow-2xl rounded-[3rem] overflow-hidden border-[8px] border-slate-900 ${inter.className}`}>

                {/* Status Bar Fake */}
                <div className="h-7 bg-white w-full flex justify-between items-center px-6 pt-2 z-50">
                    <div className="text-[10px] font-bold text-black">9:41</div>
                    <div className="flex gap-1.5">
                        <div className="w-4 h-2.5 bg-black rounded-sm"></div>
                        <div className="w-3 h-2.5 bg-black rounded-sm"></div>
                        <div className="w-5 h-2.5 bg-black rounded text-[8px] text-white flex items-center justify-center">4G</div>
                    </div>
                </div>

                {/* Header (Simplified) */}
                <header className="flex-shrink-0 z-40 bg-white/80 backdrop-blur-md pt-4 pb-4 px-6 border-b border-slate-100">
                    <div className="flex items-center justify-start">
                        <h1 className="text-xl font-black tracking-tighter text-slate-900">YouCanGo <span className="text-slate-400">Pro</span></h1>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 flex flex-col overflow-y-auto hide-scrollbar relative bg-slate-50">
                    {children}
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-900 rounded-full z-50 mb-2"></div>
            </main>
        </div>
    );
}
