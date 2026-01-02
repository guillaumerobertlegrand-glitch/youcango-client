'use client';

import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function PaymentForm({ onBack, onSuccess }: { onBack: () => void, onSuccess: () => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setLoading(true);
        setErrorMessage(null);

        const { error } = await stripe.confirmSetup({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/`,
            },
            redirect: "if_required",
        });

        if (error) {
            setErrorMessage(error.message || "An unexpected error occurred.");
            setLoading(false);
        } else {
            // Setup successful
            setLoading(false);
            onSuccess();
            // Depending on flow, we might redirect here or let the parent handle it. 
            // If redirect="if_required" and no redirect happens, it means it succeeded (non-3DS).
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />

            {errorMessage && (
                <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                    {errorMessage}
                </div>
            )}

            <Button type="submit" className="w-full" disabled={!stripe || loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Payment Method Value"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={loading}>
                Back
            </Button>
        </form>
    );
}
