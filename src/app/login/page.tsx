
import { loginWithProvider } from "./actions";
import { AuthForm } from "./auth-form";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default async function LoginPage(props: {
    searchParams: Promise<{ message: string; error: string }>;
}) {
    const searchParams = await props.searchParams;

    return (
        <div className="flex flex-col items-center justify-start min-h-full bg-[#F5F5F7] p-6 pt-10 font-sans">
            <div className="w-full max-w-[400px] bg-white rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-10">

                {/* Header */}
                <div className="flex flex-col items-center space-y-4 mb-8">
                    <div className="text-center">
                        <h1 className="text-[28px] font-bold text-gray-900 tracking-tight leading-tight">YouCanGo</h1>
                        <p className="text-[17px] text-[#86868b] mt-1 font-normal">La passerelle IA vers le monde réel</p>
                    </div>
                </div>

                {/* Notifications */}
                <div className="space-y-4 mb-6">
                    {searchParams?.error && (
                        <div className="p-3.5 rounded-[12px] bg-red-50 text-red-600 text-[15px] font-medium text-center border border-red-100">
                            {searchParams.error}
                        </div>
                    )}
                    {searchParams?.message && (
                        <div className="p-3.5 rounded-[12px] bg-green-50 text-green-600 text-[15px] font-medium text-center border border-green-100">
                            {searchParams.message}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <AuthForm />

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-3 text-[#86868b] font-medium">
                                Ou continuer avec
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <form action={async () => {
                            "use server"
                            await loginWithProvider("google")
                        }}>
                            <Button
                                variant="outline"
                                className="w-full h-[50px] bg-white border border-[#d2d2d7] hover:bg-[#F5F5F7] hover:border-[#86868b] text-[#1d1d1f] font-medium text-[17px] rounded-[14px] relative transition-all"
                                type="submit"
                            >
                                <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                                Google
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-[13px] text-[#86868b]">
                <p>&copy; 2026 YouCanGo. Tous droits réservés.</p>
            </div>
        </div>
    );
}
