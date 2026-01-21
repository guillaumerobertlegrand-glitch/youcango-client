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
    const [commercialName, setCommercialName] = useState(""); // Linked to organizations.name
    const [apeCode, setApeCode] = useState("");

    // Location Data
    const [address, setAddress] = useState("Adresse inconnue");
    const [lat, setLat] = useState<number>(48.8566);
    const [long, setLong] = useState<number>(2.3522);

    // API Search State
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Google Places State
    const [googleData, setGoogleData] = useState<any>(null);
    const [enrichmentConfirmed, setEnrichmentConfirmed] = useState(false);

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
                    .select('organization_id, job_title, organization:organizations(id, siret, official_name, name, ape_code)')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (pro && pro.organization) {
                    setMode('update');
                    setOrgId(pro.organization_id);
                    // @ts-ignore
                    const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;
                    setSiret(org.siret || "");
                    setOfficialName(org.official_name || "");
                    setCommercialName(org.name || org.official_name || ""); // Load Name
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

    // Google Places Search
    const searchGooglePlace = async (query: string) => {
        try {
            const res = await fetch('/api/google-places', {
                method: 'POST',
                body: JSON.stringify({ query }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (data.found) {
                setGoogleData(data);
            } else {
                console.warn("Google Place Not Found");
                setGoogleData(null);
            }
        } catch (e) {
            console.error("Google Search Failed", e);
        }
    };

    // Data.gouv.fr Search
    const searchSiret = async () => {
        if (siret.length < 9) {
            setSearchError("SIRET trop court (9 ou 14 chiffres).");
            return;
        }
        setIsSearching(true);
        setSearchError(null);
        setGoogleData(null);
        setEnrichmentConfirmed(false);

        try {
            // Search API
            const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`);
            if (!response.ok) throw new Error("API non disponible");

            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                const cleanOfficialName = result.nom_complet || "";

                setOfficialName(cleanOfficialName);
                if (!commercialName) setCommercialName(cleanOfficialName); // Pre-fill if empty
                setApeCode(result.activite_principale || "");

                // Capture Location
                const rawAddress = result.siege?.geo_adresse || result.siege?.adresse || "Adresse inconnue";
                setAddress(rawAddress);

                let foundLat = 48.8566;
                let foundLong = 2.3522;
                if (result.siege?.latitude) {
                    foundLat = parseFloat(result.siege.latitude);
                    setLat(foundLat);
                }
                if (result.siege?.longitude) {
                    foundLong = parseFloat(result.siege.longitude);
                    setLong(foundLong);
                }

                setSearchError(null);

                // ZERO FRICTION: Trigger Google Search
                const queryName = commercialName || cleanOfficialName;
                searchGooglePlace(`${queryName} ${rawAddress}`);
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
        if (code.length === 0) return true; // Empty is valid before check
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

        // 1.6 Validate Profile Fields
        if (!firstName || !lastName || !jobTitle || !commercialName) {
            alert("Veuillez remplir toutes les informations (Nom commercial, Profil).");
            setLoading(false);
            return;
        }

        // 2. CREATE (Bootstrap v4 - Clean Name to bypass PostgREST cache zombie)
        if (mode === 'create') {
            const payload = {
                p_org_name: commercialName,
                p_first_name: firstName,
                p_last_name: lastName,
                p_job_title: jobTitle,
                p_siret: siret,
                p_official_name: officialName,
                p_ape_code: apeCode,
                p_specialty_id: null,
                p_address: address,
                p_lat: lat,
                p_long: long,
                p_google_place_id: enrichmentConfirmed ? googleData?.place_id : null,
                p_opening_hours: enrichmentConfirmed ? googleData?.opening_hours : {},
                p_photos: enrichmentConfirmed ? googleData?.photoUrl ? [{ url: googleData.photoUrl }] : [] : [],
                p_website: enrichmentConfirmed ? googleData?.website : null
            };

            const { data, error } = await supabase.rpc('api_create_org_v4', { payload });

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
                name: commercialName, // Update Commercial Name
                ape_code: apeCode
                // Note: We are not updating Google Data on edit mode for now, as request focused on Creation/Bootstrap.
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
            }).eq('organization_id', orgId).eq('role', 'admin');

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

                {/* Google Place Match (Step 1.5 - Zero Friction) */}
                {googleData && !enrichmentConfirmed && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded p-4 animate-in slide-in-from-top-4">
                        <div className="flex gap-4 items-start">
                            <div className="bg-indigo-100 p-2 rounded-full">
                                <span className="text-2xl">🗺️</span>
                            </div>
                            <div className="flex-grow">
                                <h3 className="font-semibold text-indigo-900">Est-ce bien votre établissement ?</h3>
                                <p className="text-sm text-indigo-700">{googleData.name}</p>
                                <p className="text-xs text-indigo-600 mb-2">{googleData.address}</p>

                                {googleData.photoUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={googleData.photoUrl} alt="Google Place" className="w-full h-32 object-cover rounded mb-2 border border-indigo-100" />
                                )}

                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => {
                                        // Enrich Data
                                        if (googleData.lat) setLat(googleData.lat);
                                        if (googleData.lng) setLong(googleData.lng);
                                        if (googleData.address) setAddress(googleData.address); // Sync Address
                                        // We will pass other googleData (hours, photos) directly in handleNext
                                        setEnrichmentConfirmed(true);
                                    }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                        Oui, c'est moi
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setGoogleData(null)} className="text-slate-500">
                                        Non / Ignorer
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {enrichmentConfirmed && (
                    <div className="bg-green-50 border border-green-200 p-3 rounded text-sm text-green-800 flex items-center gap-2">
                        ✅ Infos Google récupérées (Photos, Horaires, GPS précis).
                    </div>
                )}

                {/* Results Block (Company) */}
                <div className="grid gap-4 bg-slate-50 p-4 rounded">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-600">Raison Sociale (Auto)</label>
                        <input className="border p-2 rounded w-full bg-slate-100 text-slate-600" disabled value={officialName} />
                    </div>

                    {/* Commercial Name - Editable */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-indigo-700">Nom Commercial / Enseigne</label>
                        <input
                            className="border p-2 rounded w-full border-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            value={commercialName}
                            onChange={e => setCommercialName(e.target.value)}
                            placeholder="Nom affiché aux clients (ex: Chez Marco)"
                        />
                        <p className="text-xs text-slate-500 mt-1">C'est le nom que verront vos clients.</p>
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

            </div>

            <Button onClick={handleNext} className="w-full" size="lg" disabled={!officialName || !isValidApe(apeCode) || !firstName || !lastName || !jobTitle}>
                {mode === 'create' ? "Créer mon Espace & Continuer" : "Valider & Suivant"}
            </Button>
        </div>
    );
}
