
"use client";

import { updateProfile, createSetupIntent } from "@/app/onboarding/actions";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import PaymentForm from "./PaymentForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, CreditCard, Loader2 } from "lucide-react";


const getStripePromise = () => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
        console.warn("WARNING: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined");
        return null;
    }
    return loadStripe(key);
};

const stripePromise = getStripePromise();

export default function OnboardingForm({ user }: { user: any }) {
    const [step, setStep] = useState(1);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || "");
    const [lastName, setLastName] = useState(user?.user_metadata?.last_name || "");
    const [phone, setPhone] = useState("");



    // ... inside component ...

    const [error, setError] = useState<string | null>(null);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('firstName', firstName);
        formData.append('lastName', lastName);
        formData.append('phone', phone);

        const result = await updateProfile(formData);

        setLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            // Fetch Setup Intent
            const intent = await createSetupIntent();
            if (intent.error || !intent.clientSecret) {
                setError(intent.error || "Failed to initialize payment setup.");
            } else {
                setClientSecret(intent.clientSecret);
                setStep(2);
            }
        }
    };



    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md border-slate-200 shadow-xl">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        {/* Progress Dots */}
                        <div className="flex gap-2">
                            <div className={`h-2 w-2 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                            <div className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">
                        {step === 1 ? "Complete your Profile" : "Add Payment Method"}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 ? "Let pros know who they are confirming." : "Secure your account for future requests."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 1 ? (
                        <form onSubmit={handleProfileSubmit} className="space-y-6">
                            {error && (
                                <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                                    {error}
                                </div>
                            )}
                            <div className="flex justify-center">
                                <div className="relative cursor-pointer group">
                                    <Avatar className="h-24 w-24">
                                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                                        <AvatarFallback className="text-xl bg-slate-100">
                                            {firstName && lastName ? `${firstName[0]}${lastName[0]}`.toUpperCase() : "ME"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="text-white h-8 w-8" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstname">First Name</Label>
                                    <Input
                                        id="firstname"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="John"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastname">Last Name</Label>
                                    <Input
                                        id="lastname"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Doe"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number (Optional)</Label>
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+33 6 12 34 56 78"
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Next"}
                            </Button>
                        </form>
                    ) : (
                        clientSecret && stripePromise && (
                            <Elements stripe={stripePromise} options={{ clientSecret }}>
                                <PaymentForm
                                    onBack={() => setStep(1)}
                                    onSuccess={() => window.location.href = "/"}
                                />
                            </Elements>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
