"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step1IdentityPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    // State
    const [mode, setMode] = useState<'create' | 'update'>('create');
    const [orgId, setOrgId] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<{ first: string, last: string } | null>(null);

    // Identity Form
    const [siret, setSiret] = useState("");
    const [officialName, setOfficialName] = useState("");
    const [apeCode, setApeCode] = useState("");

    // API Search State
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Initialization
    useEffect(() => {
        async function init() {
            try {
                // Auth Check
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.push("/login");

                // Get User Profile (for bootstrap)
                const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single();
                if (profile) setUserProfile({ first: profile.first_name || '', last: profile.last_name || '' });

                // Get Pro & Org
                const { data: pro } = await supabase
                    .from('professionals')
                    .select('organization_id, organization:organizations(id, siret, official_name, ape_code)')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (pro && pro.organization) {
                    setMode('update');
                    setOrgId(pro.organization_id);
                    // @ts-ignore
                    const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;
                    setSiret(org.siret || "");
                    setOfficialName(org.official_name || "");
                    setApeCode(org.ape_code || "");
                } else {
                    setMode('create'); // No org found -> Creation Mode
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [router, supabase]);

    // Data.gouv.fr Search
    const searchSiret = async () => {
        if (siret.length < 9) {
            setSearchError("SIRET trop court (9 ou 14 chiffres).");
            return;
        }
        setIsSearching(true);
        setSearchError(null);

        try {
            // Search API
            const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`);
            if (!response.ok) throw new Error("API non disponible");

            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                setOfficialName(result.nom_complet || "");
                setApeCode(result.activite_principale || "");
                setSearchError(null);
            } else {
                setSearchError("Aucune entreprise trouvée.");
            }
        } catch (e) {
            setSearchError("Erreur de recherche API.");
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    // Validation Logic
    const isValidApe = (code: string) => {
        const c = code.replace('.', '').toUpperCase();
        // Whitelist: 56*, 4520*, 9602A, 9602B
        if (c.startsWith('56')) return true; // Restaurants
        if (c.startsWith('4520')) return true; // Garages
        if (c === '9602A' || c === '9602B') return true; // Coiffure / Beauté
        return false;
    };

    const handleNext = async () => {
        setLoading(true);

        // 1. Validate APE
        if (!isValidApe(apeCode)) {
            alert("Activité non autorisée pour YouCanGo Pro (Restauration, Beauté, Garage uniquement).");
            setLoading(false);
            return;
        }

        // 2. CREATE (Bootstrap)
        if (mode === 'create') {
            const { data, error } = await supabase.rpc('api_v1_bootstrap_organization', {
                p_org_name: officialName, // Use official name as provisional name
                p_first_name: userProfile?.first || 'Admin',
                p_last_name: userProfile?.last || 'User',
                p_siret: siret,
                p_official_name: officialName,
                p_ape_code: apeCode
            });

            if (error) {
                alert("Erreur Création: " + error.message);
                setLoading(false);
                return;
            }

            // Success -> Org Created -> Step 1 Valid by definition (RPC sets it to 1, we validate to move to 2)
            // But wait, the RPC sets step to 1. We need to validate Step 1 to move to 2.
            const newOrgId = data.organization_id;

            // Validate Step 1 (Move to 2)
            await validateStep(newOrgId);

        } else {
            // 3. UPDATE (Existing)
            if (!orgId) return;
            const { error } = await supabase.from('organizations').update({
                siret,
                official_name: officialName,
                ape_code: apeCode
            }).eq('id', orgId);

            if (error) {
                alert("Erreur Update: " + error.message);
                setLoading(false);
                return;
            }

            await validateStep(orgId);
        }
    };

    const validateStep = async (targetOrgId: string) => {
        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', {
            p_step: 1,
            p_org_id: targetOrgId
        });

        if (result.valid) {
            await supabase.from('organizations').update({ onboarding_step: 2 }).eq('id', targetOrgId);
            router.push("/onboardingpro/step-2-finance");
        } else {
            alert("Validation technique échouée post-création. Contactez le support.");
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-2xl mx-auto animation-fade-in">
            <h1 className="text-2xl font-bold">
                {mode === 'create' ? "Création de votre Espace Pro" : "Étape 1 : Identité Légale"}
            </h1>
            <p className="text-gray-500">
                {mode === 'create'
                    ? "Pour commencer, identifiez votre établissement grâce à votre numéro SIRET."
                    : "Vérifiez les informations légales de votre entreprise."}
            </p>

            <div className="space-y-6 border p-6 rounded bg-white shadow-sm">

                {/* SIRET Search Block */}
                <div className="flex gap-2 items-end">
                    <div className="flex-grow">
                        <label className="block text-sm font-medium mb-1">Numéro SIRET</label>
                        <input
                            className="border p-2 rounded w-full"
                            placeholder="14 chiffres sans espaces"
                            value={siret}
                            onChange={e => setSiret(e.target.value.replace(/\s/g, ''))}
                        />
                    </div>
                    <Button onClick={searchSiret} disabled={isSearching} variant="secondary">
                        {isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : "Rechercher"}
                    </Button>
                </div>
                {searchError && <p className="text-red-500 text-sm">{searchError}</p>}

                {/* Results Block */}
                <div className="grid gap-4 bg-slate-50 p-4 rounded">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-600">Raison Sociale (Auto)</label>
                        <input className="border p-2 rounded w-full bg-slate-100 text-slate-600" disabled value={officialName} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-600">Code APE (Auto)</label>
                        <input className="border p-2 rounded w-full bg-slate-100 text-slate-600" disabled value={apeCode} />
                        {apeCode && !isValidApe(apeCode) && (
                            <p className="text-red-500 text-xs mt-1">⚠️ Activité non supportée par la plateforme.</p>
                        )}
                        {apeCode && isValidApe(apeCode) && (
                            <p className="text-green-600 text-xs mt-1">✅ Activité éligible.</p>
                        )}
                    </div>
                </div>
            </div>

            <Button onClick={handleNext} className="w-full" size="lg" disabled={!officialName || !isValidApe(apeCode)}>
                {mode === 'create' ? "Créer mon Espace & Continuer" : "Valider & Suivant"}
            </Button>
        </div>
    );
}
