"use client";

import { useState } from "react";
import { Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signout } from "@/app/login/actions";

export default function ProHeaderSettings() {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="text-slate-900 hover:bg-slate-100 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <Settings size={34} className="stroke-[2.5px]" />
            </Button>

            {open && (
                <>
                    {/* Backdrop to close on click outside */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

                    {/* Menu - Right Aligned below header */}
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <form action={signout}>
                            <button
                                type="submit"
                                className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-50 text-sm font-medium flex items-center gap-2 transition-colors"
                            >
                                <LogOut size={16} />
                                Déconnecter
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}
