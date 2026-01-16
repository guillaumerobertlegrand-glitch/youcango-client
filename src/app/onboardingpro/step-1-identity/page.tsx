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

    // Identity Form
    const [siret, setSiret] = useState("");
    const [officialName, setOfficialName] = useState("");
    const [apeCode, setApeCode] = useState("");
    // Location Data
    const [address, setAddress] = useState("Adresse inconnue");
    const [lat, setLat] = useState<number>(48.8566);
    const [long, setLong] = useState<number>(2.3522);

    // API Search State
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Pro Profile State
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [jobTitle, setJobTitle] = useState("");

    // Initialization
    useEffect(() => {
        async function init() {
            try {
                // Auth Check
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.push("/login");

                // Get User Profile (for bootstrap)
                const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single();
                if (profile) {
                    setFirstName(profile.first_name || '');
                    setLastName(profile.last_name || '');
                }

                // Get Pro & Org
                const { data: pro } = await supabase
                    .from('professionals')
                    .select('organization_id, job_title, organization:organizations(id, siret, official_name, ape_code)')
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
                    // Pre-fill existing pro data
                    setJobTitle(pro.job_title || "");
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
                const cleanOfficialName = result.nom_complet || "";
                setOfficialName(cleanOfficialName);
                setApeCode(result.activite_principale || "");

                // Auto-fill Name/Surname from Official Name if it looks like a person's name (common for solo entrepreneurs)
                // Heuristic: If official name contains space and user profile is empty (edge case)
                // But generally relying on user profile is better.

                // Capture Location
                setAddress(result.siege?.geo_adresse || result.siege?.adresse || "Adresse inconnue");
                if (result.siege?.latitude) setLat(parseFloat(result.siege.latitude));
                if (result.siege?.longitude) setLong(parseFloat(result.siege.longitude));

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

    // Specialty Logic
    const [specialties, setSpecialties] = useState<any[]>([]);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");

    useEffect(() => {
        if (!apeCode) return;
        // Search by APE prefix (e.g. '56' matches '56.10A')
        // We try exact match first, then 2 digits.
        async function loadSpecialties() {
            // Find finding the industry prefix.
            // Simplified logic: Check if APE starts with '56', '9602A', etc.
            let prefix = "";
            const cleanApe = apeCode.replace('.', '').toUpperCase();

            if (cleanApe.startsWith('56')) prefix = '56';
            else if (cleanApe.startsWith('4520')) prefix = '4520';
            else if (cleanApe === '9602A') prefix = '9602A';
            else if (cleanApe === '9602B') prefix = '9602B';

            if (prefix) {
                const { data } = await supabase.from('config_specialties').select('id, label').eq('industry_prefix', prefix);
                setSpecialties(data || []);
            } else {
                setSpecialties([]);
            }
        }
        loadSpecialties();
    }, [apeCode, supabase]);


    const handleNext = async () => {
        setLoading(true);

        // 1. Validate APE
        if (!isValidApe(apeCode)) {
            alert("Activité non autorisée pour YouCanGo Pro (Restauration, Beauté, Garage uniquement).");
            setLoading(false);
            return;
        }

        // 1.5 Validate Specialty (Required if options available)
        if (specialties.length > 0 && !selectedSpecialty) {
            alert("Veuillez sélectionner votre spécialité.");
            setLoading(false);
            return;
        }

        // 1.6 Validate Profile Fields
        if (!firstName || !lastName || !jobTitle) {
            alert("Veuillez remplir votre profil (Prénom, Nom, Fonction).");
            setLoading(false);
            return;
        }

        // 2. CREATE (Bootstrap)
        if (mode === 'create') {
            const { data, error } = await supabase.rpc('api_v1_bootstrap_organization', {
                p_org_name: officialName,
                p_first_name: firstName,
                p_last_name: lastName,
                p_job_title: jobTitle,
                p_siret: siret,
                p_official_name: officialName,
                p_ape_code: apeCode,
                p_specialty_id: selectedSpecialty || null,
                p_address: address, // Pass Captured
                p_lat: lat,         // Pass Captured
                p_long: long        // Pass Captured
            });

            if (error) {
                alert("Erreur Création: " + error.message);
                setLoading(false);
                return;
            }

            const newOrgId = data.organization_id;
            await validateStep(newOrgId);

        } else {
            // 3. UPDATE (Existing)
            if (!orgId) return;
            const { error: orgError } = await supabase.from('organizations').update({
                siret,
                official_name: officialName,
                ape_code: apeCode
            }).eq('id', orgId);

            if (orgError) {
                alert("Erreur Update Org: " + orgError.message);
                setLoading(false);
                return;
            }

            // Also update Pro Profile on edit
            const { error: proError } = await supabase.from('professionals').update({
                first_name: firstName,
                last_name: lastName,
                job_title: jobTitle
            }).eq('organization_id', orgId).eq('role', 'admin'); // Assuming current user is admin

            if (proError) {
                console.error("Pro Update Error", proError);
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
                    ? "Pour commencer, identifiez votre établissement et vous-même."
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

                {/* Results Block (Compagny) */}
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

                {/* Profile Fields (Required) */}
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="col-span-1">
                        <label className="block text-sm font-medium mb-1">Prénom</label>
                        <input
                            className="border p-2 rounded w-full"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            placeholder="Jean"
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm font-medium mb-1">Nom</label>
                        <input
                            className="border p-2 rounded w-full"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            placeholder="Dupont"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Fonction / Rôle</label>
                        <input
                            className="border p-2 rounded w-full"
                            value={jobTitle}
                            onChange={e => setJobTitle(e.target.value)}
                            placeholder="Ex: Gérant, Directeur technique, Chef d'atelier..."
                        />
                    </div>
                </div>

                {/* Specialty Selector (Step 1.5) */}
                {specialties.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-4 pt-4 border-t">
                        <label className="block text-sm font-medium mb-1">Quelle est votre spécialité ?</label>
                        <select
                            className="border p-2 rounded w-full bg-white"
                            value={selectedSpecialty}
                            onChange={e => setSelectedSpecialty(e.target.value)}
                        >
                            <option value="">Sélectionnez une option...</option>
                            {specialties.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Cela nous permet de pré-configurer votre catalogue de services.
                        </p>
                    </div>
                )}

            </div>

            <Button onClick={handleNext} className="w-full" size="lg" disabled={!officialName || !isValidApe(apeCode) || !firstName || !lastName || !jobTitle}>
                {mode === 'create' ? "Créer mon Espace & Continuer" : "Valider & Suivant"}
            </Button>
        </div>
    );
}
