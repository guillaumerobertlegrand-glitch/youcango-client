"use client";

import { useFormStatus } from "react-dom";
import { login, signup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

function SubmitButton({ children, formAction, variant = "default" }: { children: React.ReactNode, formAction: (formData: FormData) => Promise<void>, variant?: "default" | "ghost" }) {
    const { pending } = useFormStatus();

    const baseStyles = "w-full h-[50px] font-semibold text-[17px] rounded-[14px] transition-all active:scale-[0.98]";
    const variantStyles = variant === "default"
        ? "bg-[#007AFF] hover:bg-[#0071EB] text-white shadow-sm"
        : "bg-gray-100 hover:bg-gray-200 text-[#1d1d1f]";

    return (
        <Button
            type="submit"
            formAction={formAction}
            disabled={pending}
            className={`${baseStyles} ${variantStyles}`}
        >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </Button>
    );
}

export function AuthForm() {
    return (
        <div className="space-y-6">
            <form className="space-y-5">
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
                    <SubmitButton formAction={signup}>Créer un compte</SubmitButton>
                    <SubmitButton formAction={login} variant="ghost">Se connecter</SubmitButton>
                </div>
            </form>
        </div>
    );
}
