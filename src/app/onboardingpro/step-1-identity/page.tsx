"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";
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
                    // Filter out default "New User" from Auth provider
                    const f = profile.first_name === 'New' ? '' : profile.first_name || '';
                    const l = profile.last_name === 'User' ? '' : profile.last_name || '';
                    setFirstName(f);
                    setLastName(l);
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
        <div className="flex flex-col min-h-full">
            <div className="flex-grow p-4 space-y-6">
                <div className="space-y-5 pt-6">

                    {/* SIRET & Official Info Block */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                        {/* SIRET Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">Numéro SIRET</label>
                            <div className="flex gap-2">
                                <input
                                    className="flex-grow border p-2.5 rounded-lg bg-slate-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20 border-slate-200 text-sm"
                                    placeholder="14 chiffres"
                                    value={siret}
                                    onChange={e => setSiret(e.target.value.replace(/\s/g, ''))}
                                    inputMode="numeric"
                                />
                                <Button
                                    onClick={searchSiret}
                                    disabled={isSearching}
                                    variant="ghost"
                                    className="px-4 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500"
                                >
                                    {isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : "🔍"}
                                </Button>
                            </div>
                            {searchError && <p className="text-red-500 text-xs px-1">{searchError}</p>}
                        </div>

                        {/* Automated Info (Raison sociale, APE) */}
                        {officialName && (
                            <div className="pt-3 border-t border-slate-50 grid gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 tracking-wider ml-1">Raison sociale</label>
                                    <div className="w-full p-2.5 rounded-lg bg-slate-50 text-slate-600 text-sm border border-slate-100 font-medium">
                                        {officialName}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 tracking-wider ml-1">Code APE</label>
                                    <div className="flex items-center gap-2 w-full p-2.5 rounded-lg bg-slate-50 text-slate-600 text-sm border border-slate-100 font-medium">
                                        <span>{apeCode}</span>
                                        {apeCode && isValidApe(apeCode) && <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto" />}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Google Place Match (Step 1.5 - Zero Friction) */}
                    {googleData && !enrichmentConfirmed && (
                        <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-md animate-in slide-in-from-bottom-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="bg-indigo-50 p-2 rounded-lg">
                                    <span className="text-xl">📍</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 text-sm">C'est bien ici ?</h3>
                                    <p className="text-sm text-indigo-900 font-medium">{googleData.name}</p>
                                    <p className="text-xs text-slate-500 leading-tight">{googleData.address}</p>
                                </div>
                            </div>

                            {googleData.photoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
                                    <img src={googleData.photoUrl} alt="Google Place" className="w-full h-full object-cover" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <Button size="sm" variant="ghost" onClick={() => setGoogleData(null)} className="text-slate-400 hover:text-slate-600">
                                    Non
                                </Button>
                                <Button size="sm" onClick={() => {
                                    // Enrich Data
                                    if (googleData.lat) setLat(googleData.lat);
                                    if (googleData.lng) setLong(googleData.lng);
                                    if (googleData.address) setAddress(googleData.address);
                                    setEnrichmentConfirmed(true);
                                }} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-lg">
                                    Oui, c'est moi
                                </Button>
                            </div>
                        </div>
                    )}

                    {enrichmentConfirmed && (
                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs font-medium text-emerald-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Infos Google récupérées.
                        </div>
                    )}

                    {/* Commercial Name (Editable) */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1.5">
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-slate-900 tracking-wider ml-1">Nom Commercial</label>
                            <span className="text-[10px] text-slate-400 ml-1 font-medium">(Celui visible par vos clients YouCanGo)</span>
                        </div>
                        <input
                            className="w-full p-3 rounded-lg border-2 border-indigo-50 focus:border-indigo-500 focus:ring-0 text-slate-900 font-bold transition-all placeholder:font-normal"
                            value={commercialName}
                            onChange={e => setCommercialName(e.target.value)}
                        />
                    </div>

                    {/* Profile Fields */}
                    <div className="pt-4 border-t border-slate-100 hidden"></div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                        <h3 className="font-semibold text-slate-900">Votre Profil</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs text-slate-500">Prénom</label>
                                <input className="w-full border p-2.5 rounded-lg text-sm" value={firstName} onChange={e => setFirstName(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-500">Nom</label>
                                <input className="w-full border p-2.5 rounded-lg text-sm" value={lastName} onChange={e => setLastName(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500">Fonction / Rôle</label>
                            <input className="w-full border p-2.5 rounded-lg text-sm" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Gérant, Directeur, Responsable de salle..." />
                        </div>
                    </div>

                </div>
            </div>

            {/* Sticky Footer Action */}
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-100 pb-8">
                <Button
                    onClick={handleNext}
                    className="w-full h-12 text-base font-semibold shadow-xl shadow-indigo-200"
                    disabled={!officialName || !isValidApe(apeCode) || !firstName || !lastName || !jobTitle}
                >
                    Valider et suivant
                </Button>
            </div>
        </div>
    );
}
