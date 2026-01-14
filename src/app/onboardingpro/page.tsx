"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProOnboardingPage() {
    const supabase = createClient();
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);

    // Form Data States (Minimal binding)
    const [siret, setSiret] = useState("");
    const [officialName, setOfficialName] = useState("");
    const [apeCode, setApeCode] = useState("");
    const [stripeEmail, setStripeEmail] = useState(""); // Simplified Trigger
    const [inviteEmail, setInviteEmail] = useState("");

    // Create Org States
    const [isCreating, setIsCreating] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    // Initialize State
    useEffect(() => {
        async function init() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoading(false);
                    return;
                }

                const { data: pro, error } = await supabase
                    .from('professionals')
                    .select('id, role, organization_id, organization:organizations(onboarding_step, siret, official_name, ape_code)')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (pro) {
                    setRole(pro.role);
                    setOrgId(pro.organization_id);
                    // @ts-ignore
                    const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;
                    if (org) {
                        setStep(org.onboarding_step || 1);
                        setSiret(org.siret || "");
                        setOfficialName(org.official_name || "");
                        setApeCode(org.ape_code || "");
                    }
                } else {
                    console.log("No Pro profile found. User needs to create an organization.");
                    setIsCreating(true);
                }
            } catch (e) {
                console.error("Init Error:", e);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [supabase]);

    const handleCreateOrg = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('api_v1_bootstrap_organization', {
            p_org_name: newOrgName,
            p_first_name: firstName,
            p_last_name: lastName
        });

        if (error) {
            alert("Creation Failed: " + error.message);
            setLoading(false);
        } else {
            // success, reload page or set state manually
            window.location.reload();
        }
    };


    // Validation & Next Step
    const handleNext = async () => {
        if (!orgId) return;
        setLoading(true);

        try {
            // 1. Call Master Validator
            const { data: result, error } = await supabase.rpc('api_v1_validate_onboarding_step', {
                p_step: step,
                p_org_id: orgId
            });

            if (error) throw error;

            if (result.valid) {
                await supabase.from('organizations').update({ onboarding_step: step + 1 }).eq('id', orgId);
                setStep(step + 1);
            } else {
                alert(`Validation incomplète : ${result.details?.join(", ") || "Vérifiez les champs requis."}`);
            }

        } catch (e: any) {
            alert("Erreur : " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Finalize
    const handleComplete = async () => {
        if (!orgId) return;
        setLoading(true);
        const { data, error } = await supabase.rpc('api_v1_complete_onboarding', { p_org_id: orgId });
        if (error || !data.success) {
            alert("Completion Failed: " + (error?.message || data?.error));
            setLoading(false);
        } else {
            router.push('/pro');
        }
    };

    // Helper: Step 1 Update Identity
    const saveIdentity = async () => {
        if (!orgId) return;

        const { error } = await supabase.from('organizations').update({
            siret,
            official_name: officialName,
            ape_code: apeCode
        }).eq('id', orgId);

        if (error) {
            console.error("Save Error:", error);
            alert("Erreur de sauvegarde : " + error.message);
        } else {
            // Optional: sleek toast instead of alert? For now, silence is golden or a small visual cue.
            // But let's keep a small alert for confirmation until we have UI Toasts.
            alert("Identité sauvegardée avec succès !");
        }
    };

    // Helper: Invite Editor
    const sendInvite = async () => {
        if (!orgId) return;
        const res = await fetch('/api/invite-editor', {
            method: 'POST',
            body: JSON.stringify({ email: inviteEmail, organization_id: orgId })
        });
        const json = await res.json();
        alert(json.message || json.error);
    };


    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    if (isCreating) {
        return (
            <div className="p-6 space-y-8 max-w-md mx-auto mt-10 border rounded bg-slate-50">
                <h1 className="text-2xl font-bold">Bienvenue sur YouCanGo Pro !</h1>
                <p>Pour commencer, créez votre organisation.</p>
                <div className="space-y-4">
                    <input className="border p-2 w-full" placeholder="Nom de votre Entreprise (Enseigne)" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} />
                    <div className="flex gap-2">
                        <input className="border p-2 w-full" placeholder="Votre Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} />
                        <input className="border p-2 w-full" placeholder="Votre Nom" value={lastName} onChange={e => setLastName(e.target.value)} />
                    </div>
                    <Button onClick={handleCreateOrg} className="w-full">Créer mon Espace</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-8">
            <h1 className="text-2xl font-bold">Onboarding Pro - Étape {step}/4</h1>

            {/* STEP 1: IDENTITY & TEAM */}
            {step === 1 && (
                <div className="space-y-4 border p-4 rounded">
                    <h2 className="font-semibold">1. Identité & Équipe</h2>
                    <div className="grid gap-2">
                        <input className="border p-2" placeholder="SIRET" value={siret} onChange={e => setSiret(e.target.value)} />
                        <input className="border p-2" placeholder="Raison Sociale" value={officialName} onChange={e => setOfficialName(e.target.value)} />
                        <input className="border p-2" placeholder="Code APE" value={apeCode} onChange={e => setApeCode(e.target.value)} />
                        <Button onClick={saveIdentity} size="sm" variant="outline">Sauvegarder Identité</Button>
                    </div>

                    {role === 'admin' ? (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="font-medium">Admin Zone: Stripe & Invites</h3>
                            <p className="text-sm text-gray-500">Stripe Secret simulated via DB insertion.</p>
                            <div className="flex gap-2 mt-2">
                                <input className="border p-2" placeholder="Email Collaborateur" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                                <Button onClick={sendInvite} size="sm">Inviter Editor</Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-yellow-600 mt-2">Section Finance masquée (Rôle: {role})</p>
                    )}
                </div>
            )}

            {/* STEP 2: SERVICES */}
            {step === 2 && (
                <div className="border p-4 rounded">
                    <h2 className="font-semibold">2. Catalogue Services</h2>
                    <p>Veuillez créer au moins un service via l'interface Admin DB ou SQL pour le moment.</p>
                </div>
            )}

            {/* STEP 3: DEVICES */}
            {step === 3 && (
                <div className="border p-4 rounded">
                    <h2 className="font-semibold">3. Équipement</h2>
                    <p>Assignez un Device à chaque Pro actif.</p>
                </div>
            )}

            {/* STEP 4: AUTHORIZATIONS */}
            {step === 4 && (
                <div className="border p-4 rounded">
                    <h2 className="font-semibold">4. Habilitations</h2>
                    <p>Vérifiez la matrice de compétences.</p>
                </div>
            )}

            <div className="flex gap-4 pt-4">
                {step < 4 ? (
                    <Button onClick={handleNext} className="w-full">Valider & Suivant</Button>
                ) : (
                    <Button onClick={handleComplete} className="w-full bg-green-600 hover:bg-green-700">Terminer & Lancer</Button>
                )}
            </div>
        </div>
    );
}
