"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IOSSection, IOSRow } from "@/components/ui/ios-settings";

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
    const [city, setCity] = useState("");
    const [zip, setZip] = useState("");
    const [lat, setLat] = useState<number>(48.8566);
    const [long, setLong] = useState<number>(2.3522);

    // API Search State
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Google Places State
    const [googleData, setGoogleData] = useState<any>(null);
    const [enrichmentConfirmed, setEnrichmentConfirmed] = useState(false);

    // Manual Search State
    const [isManualSearch, setIsManualSearch] = useState(false);
    const [manualQuery, setManualQuery] = useState("");

    // Pro Profile State
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [jobTitle, setJobTitle] = useState("");

    const [userId, setUserId] = useState<string | null>(null);

    // Initialization
    useEffect(() => {
        async function init() {
            try {
                // Auth Check
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.push("/login");
                setUserId(user.id);

                // Get User Profile (for bootstrap)
                const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single();
                if (profile) {
                    // Filter out default "New User" from Auth provider
                    const f = profile.first_name === 'New' ? '' : profile.first_name || '';
                    const l = profile.last_name === 'User' ? '' : profile.last_name || '';
                    setFirstName(f);
                    setLastName(l);
                }

                // Get Pro & Org (SAFELY)
                if (!user.id) return;
                // DIAGNOSTIC STEP: Minimal query to isolate 500 error
                const { data: pro, error: proError } = await supabase
                    .from('professionals')
                    .select('id, organization_id, job_title') // Correct selection
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (proError) {
                    console.error("DIAGNOSTIC ERROR DETAILS:", JSON.stringify(proError, null, 2));
                }

                // Temporary Comment Out to isolate
                /*
                const { data: pro } = await supabase
                    .from('professionals')
                    .select('organization_id, job_title')
                    .eq('user_id', user.id)
                    .maybeSingle();
                */

                // Fake content for logic continuity if needed or just stop here for test
                if (pro) {
                    // ... logic stopped for diagnostic
                }

                if (pro && pro.organization_id) {
                    const { data: org } = await supabase
                        .from('organizations')
                        .select('id, siret, official_name, name, ape_code')
                        .eq('id', pro.organization_id)
                        .single();

                    if (org) {
                        setMode('update');
                        setOrgId(pro.organization_id);
                        setSiret(org.siret || "");
                        setOfficialName(org.official_name || "");
                        setCommercialName(org.name || org.official_name || ""); // Load Name
                        setApeCode(org.ape_code || "");
                        // Pre-fill existing pro data
                        setJobTitle(pro.job_title || "");
                    }
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

    // Helper: Simple matching score (0 to 1) 
    // Now prioritizes Address Overlap (Token-based)
    const calculateMatchScore = (siretName: string, siretCity: string, googleName: string, googleAddress: string, sAddressOverride?: string) => {
        const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
        const tokenize = (s: string) => new Set(normalize(s).split(/\s+/).filter(t => t.length > 1));

        const sName = normalize(siretName || "");
        const gName = normalize(googleName || "");
        const gAddress = normalize(googleAddress || "");

        // Address Token Match (Jaccard-ish)
        // We compare the Google Address vs (Street + City + Zip) from SIRET (which is usually in 'address' state + 'zip' logic)
        // Note: 'googleAddress' usually contains everything.
        // Let's compare googleAddress tokens with our 'address' state tokens (since 'address' comes from SIRET geo_adresse)
        const sAddrTokens = tokenize((sAddressOverride || address) + " " + (city || "")); // Use override or state city
        // We will trust the closure 'address' since it's the source.
        const gAddrTokens = tokenize(gAddress);

        let intersection = 0;
        sAddrTokens.forEach(t => { if (gAddrTokens.has(t)) intersection++; });

        const addrScore = sAddrTokens.size > 0 ? (intersection / sAddrTokens.size) : 0;

        let score = 0;

        // Pivot Strategy:
        // If Address match > 0.6 (strong overlap), we trust it highly (0.8 base).
        // If Name matches (partial), we add bonus.

        if (addrScore > 0.6) {
            score = 0.8; // High confidence based on address
            // Bonus for Name
            if (gName.includes(sName) || sName.includes(gName)) score += 0.2;
        } else {
            // Low address match, fallback to Name
            if (gName.includes(sName) || sName.includes(gName)) score += 0.4;
        }

        return score;
    };

    // Google Places Search (Unified)
    const searchGooglePlace = async (arg: string | { lat: number, lng: number, names: string[], naf: string, address?: string }) => {
        try {
            console.log("Searching Google with:", arg);

            let payload: any = {};

            if (typeof arg === 'string') {
                // Manual Text Search
                payload = { query: arg };
            } else {
                // Strict Auto Search
                payload = {
                    lat: arg.lat,
                    lng: arg.lng,
                    names: arg.names,
                    naf: arg.naf,
                    address: arg.address
                };
            }

            const res = await fetch('/api/google-places', {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (data.found) {
                setGoogleData(data);
                setIsManualSearch(false);
            } else {
                setGoogleData(null);
            }
        } catch (e) {
            setGoogleData(null);
        }
    };

    // Data.gouv.fr Search
    const searchSiret = async () => {
        if (siret.length < 9) {
            setSearchError("SIRET trop court.");
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

                // Capture Location (Prioritize matching establishment if SIRET search)
                // specific SIRET match usually appears in matching_etablissements
                const establishment = result.matching_etablissements?.[0] || result.siege;

                const rawAddress = establishment?.geo_adresse || establishment?.adresse || "Adresse inconnue";
                setAddress(rawAddress);
                const city = establishment?.libelle_commune || "";
                const zip = establishment?.code_postal || "";
                setCity(city);
                setZip(zip);

                let foundLat = 48.8566;
                let foundLong = 2.3522;
                if (establishment?.latitude) {
                    foundLat = parseFloat(establishment.latitude);
                    setLat(foundLat);
                }
                if (establishment?.longitude) {
                    foundLong = parseFloat(establishment.longitude);
                    setLong(foundLong);
                }

                setSearchError(null);

                // Match with Google Place if possible
                // STRICT LOGIC 2026: Geo + NAF + Fuzzy + Fallback

                if (foundLat && foundLong) {

                    // Extract Enseignes correctly (Array)
                    // Note: result.matching_etablissements?.[0] is 'establishment' variable
                    const enseignes = establishment?.liste_enseignes || [];

                    // Exhaustive Name Collection
                    // We map everything to string array and flattening if needed
                    const allNames = [
                        result.nom_complet,
                        result.nom_raison_sociale,
                        establishment?.denomination_usuelle,
                        ...enseignes, // Spread array
                        commercialName
                    ].filter(Boolean); // Clean empty

                    searchGooglePlace({
                        lat: foundLat,
                        lng: foundLong,
                        names: [...new Set(allNames)], // Dedup
                        naf: result.activite_principale,
                        address: rawAddress // Pass exact address for fallback
                    });
                }
            } else {
                setSearchError("Aucune entreprise trouvée.");
            }
        } catch (e) {
            setSearchError("Erreur API.");
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

        // 1. Validate APE (Safety check, should be covered by disabled button)
        if (!isValidApe(apeCode)) {
            // alert("Activité non autorisée pour YouCanGo Pro (Restauration, Beauté, Garage uniquement).");
            setLoading(false);
            return;
        }

        // 1.6 Validate Profile Fields (Safety check)
        if (!firstName || !lastName || !jobTitle || !commercialName) {
            // alert("Veuillez remplir toutes les informations.");
            setLoading(false);
            return;
        }

        // 2. CREATE (Bootstrap v4)
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

            // CRITICAL: Link Profile and Save Identity IMMEDIATELY
            if (userId) {
                const { error: profileError } = await supabase.from('profiles').update({
                    first_name: firstName,
                    last_name: lastName,
                    organization_id: newOrgId,
                    role: 'admin' // Force admin role here too
                }).eq('id', userId);

                if (profileError) console.error("Profile Link Error:", profileError);
            }

            await validateStep(newOrgId);

        } else {
            // 3. UPDATE (Existing)
            if (!orgId) return;
            const { error: orgError } = await supabase.from('organizations').update({
                siret,
                official_name: officialName,
                name: commercialName,
                ape_code: apeCode
                // Note: Not updating Google Data on edit mode strictly
            }).eq('id', orgId);

            if (orgError) {
                alert("Erreur Update Org: " + orgError.message);
                setLoading(false);
                return;
            }

            // CRITICAL: Update Profile Identity on Edit too
            if (userId) {
                await supabase.from('profiles').update({
                    first_name: firstName,
                    last_name: lastName,
                    organization_id: orgId
                }).eq('id', userId);
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
            alert("Validation technique échouée. Contactez le support.");
            setLoading(false);
        }
    };

    // Loading check
    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400" /></div>;



    // Computed Validation State
    const isFormValid =
        isValidApe(apeCode) &&
        firstName.trim().length > 0 &&
        lastName.trim().length > 0 &&
        jobTitle.trim().length > 0 &&
        commercialName.trim().length > 0;

    return (
        <div className="flex flex-col h-full font-sans bg-[#F2F2F7] relative overflow-hidden">
            <div className="flex-1 pt-0 flex flex-col overflow-y-auto">

                {/* Group 1: IDENTITY */}
                <IOSSection
                    title="Identité de l'établissement"
                    className="mt-6"
                >
                    {/* ... content ... */}
                    {/* SIRET */}
                    <IOSRow label="SIRET">
                        <div className="flex items-center gap-3 w-full justify-end">
                            <input
                                className="text-right text-[17px] bg-transparent outline-none text-[#3C3C43] placeholder:text-[#c7c7cc] w-full"
                                placeholder="14 chiffres"
                                value={siret}
                                onChange={e => setSiret(e.target.value.replace(/\s/g, ''))}
                                inputMode="numeric"
                            />

                            <button
                                onClick={searchSiret}
                                disabled={isSearching}
                                className="text-[17px] text-[#007AFF] active:opacity-50 transition-opacity whitespace-nowrap font-normal pl-2"
                            >
                                {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : "Rechercher"}
                            </button>
                        </div>
                    </IOSRow>

                    {/* Official Name (Read Only) */}
                    {officialName && (
                        <IOSRow label="Raison Sociale">
                            <span className="text-[17px] text-[#3C3C43] truncate max-w-[200px]">{officialName}</span>
                        </IOSRow>
                    )}

                    {/* Commercial Name */}
                    <IOSRow label="Nom Commercial">
                        <input
                            className="text-right text-[17px] bg-transparent outline-none text-[#3C3C43] placeholder:text-[#c7c7cc] w-full font-normal"
                            placeholder="Nom affiché"
                            value={commercialName}
                            onChange={e => setCommercialName(e.target.value)}
                        />
                    </IOSRow>

                    {/* APE Code */}
                    {apeCode && (
                        <IOSRow label="Code APE" isLast>
                            <div className="flex items-center gap-2">
                                <span className={`text-[17px] ${isValidApe(apeCode) ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>{apeCode}</span>
                                {isValidApe(apeCode) && <CheckCircle className="w-4 h-4 text-[#34C759]" />}
                            </div>
                        </IOSRow>
                    )}
                </IOSSection>

                <p className="px-[32px] mb-2 -mt-4 text-[13px] text-[#6b6b70]">
                    Le nom commercial sera visible par vos clients.
                </p>

                {/* Error Message for Search */}
                {
                    searchError && (
                        <div className="px-6 mb-4 -mt-2">
                            <p className="text-[#FF3B30] text-[13px]">{searchError}</p>
                        </div>
                    )
                }

                {/* Group 2: ADMIN */}
                <IOSSection title="Administrateur">
                    {/* First Name - No Separator, Joined with Last Name */}
                    <IOSRow label="Prénom" separator={false}>
                        <input
                            className="text-right text-[17px] bg-transparent outline-none text-[#3C3C43] placeholder:text-[#c7c7cc] w-full font-normal"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            placeholder="Requis"
                        />
                    </IOSRow>
                    {/* Last Name */}
                    <IOSRow label="Nom">
                        <input
                            className="text-right text-[17px] bg-transparent outline-none text-[#3C3C43] placeholder:text-[#c7c7cc] w-full font-normal"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            placeholder="Requis"
                        />
                    </IOSRow>
                    {/* Role */}
                    <IOSRow label="Rôle" isLast>
                        <input
                            className="text-right text-[17px] bg-transparent outline-none text-[#3C3C43] placeholder:text-[#c7c7cc] w-full font-normal"
                            value={jobTitle}
                            onChange={e => setJobTitle(e.target.value)}
                            placeholder="Directeur, Gérant..."
                        />
                    </IOSRow>
                </IOSSection>

                {/* Google Suggestion Section */}
                {!googleData && !enrichmentConfirmed && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 m-4 rounded-md hidden">
                        <p className="text-yellow-700 text-sm">Etat: {isSearching ? "Recherche en cours..." : "En attente de Google..."} (UI Debug)</p>
                    </div>
                )}
                {
                    (!enrichmentConfirmed && (googleData || isManualSearch)) && (
                        <IOSSection
                            title="Suggestion Google Maps"
                            className="mt-2"
                            footer="Confirmez pour importer l'adresse et les horaires depuis Google."
                        >

                            {isManualSearch ? (
                                <div className="p-4">
                                    <IOSRow label="Recherche" separator={false} isLast>
                                        <div className="flex items-center gap-2 w-full justify-end">
                                            <input
                                                className="text-right text-[17px] bg-transparent outline-none text-[#3C3C43] placeholder:text-[#c7c7cc] w-full"
                                                placeholder="Nom et Ville..."
                                                value={manualQuery}
                                                onChange={e => setManualQuery(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') searchGooglePlace(manualQuery); // Manual
                                                }}
                                            />
                                            <button
                                                onClick={() => searchGooglePlace(manualQuery)}
                                                className="text-[17px] text-[#007AFF] font-medium ml-2"
                                            >
                                                OK
                                            </button>
                                        </div>
                                    </IOSRow>
                                    <button
                                        onClick={() => { setIsManualSearch(false); setManualQuery(""); }}
                                        className="mt-4 text-[15px] text-[#007AFF] w-full text-center"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="p-3 bg-[#F2F2F7] mx-4 mt-4 rounded-lg">
                                        <p className="text-[15px] text-[#3C3C43] text-center font-medium">
                                            Est-ce bien votre établissement ?
                                        </p>
                                    </div>

                                    {googleData.photoUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={googleData.photoUrl}
                                            alt="Aperçu Etablissement"
                                            className="w-full h-[160px] object-cover bg-gray-100 mt-4"
                                        />
                                    ) : null}

                                    <div className="p-4 flex gap-4 border-b border-[#e5e5ea]">
                                        <div className="w-[45px] h-[45px] rounded-lg border border-[#e5e5ea] overflow-hidden shrink-0">
                                            <div className="w-full h-full bg-[#f0f0f5] flex items-center justify-center">
                                                <MapPin className="text-[#007AFF]" size={24} />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <h4 className="font-semibold text-[17px] text-black truncate leading-tight">{googleData.name}</h4>
                                            <p className="text-[13px] text-[#8E8E93] line-clamp-1 leading-tight mt-0.5">{googleData.address}</p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => {
                                                if (googleData.lat) setLat(googleData.lat);
                                                if (googleData.lng) setLong(googleData.lng);
                                                if (googleData.address) setAddress(googleData.address);
                                                setEnrichmentConfirmed(true);
                                            }}
                                            className="py-3 text-[17px] text-[#007AFF] font-bold active:bg-[#F2F2F7] transition-colors border-b border-[#e5e5ea]"
                                        >
                                            Oui
                                        </button>

                                        <button
                                            onClick={() => {
                                                setIsManualSearch(true);
                                                setManualQuery("");
                                            }}
                                            className="py-3 text-[17px] text-[#007AFF] font-normal active:bg-[#F2F2F7] transition-colors"
                                        >
                                            Non, rechercher un autre établissement
                                        </button>
                                    </div>
                                </>
                            )}
                        </IOSSection>
                    )
                }

                {enrichmentConfirmed && (
                    <IOSSection className="mt-2" title="Données importées">
                        {googleData?.photoUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={googleData.photoUrl}
                                alt="Aperçu Etablissement"
                                className="w-full h-[160px] object-cover bg-gray-100"
                            />
                        ) : (
                            <div className="w-full h-[160px] bg-gray-100 flex items-center justify-center text-gray-400">
                                <span className="text-[13px]">Pas d'image disponible</span>
                            </div>
                        )}
                        <IOSRow label="Données Google Maps" isLast>
                            <div className="flex items-center gap-2">
                                <span className="text-[17px] text-[#34C759]">Importées</span>
                                <CheckCircle className="w-4 h-4 text-[#34C759]" />
                            </div>
                        </IOSRow>
                    </IOSSection>
                )}

                {/* Fixed Bottom Button */}
            </div>

            <div className="p-4 pb-6 w-full bg-[#F2F2F7] shrink-0 z-10 relative">
                <Button
                    onClick={handleNext}
                    disabled={loading || !isFormValid}
                    className={`
                        w-full h-[50px] text-[17px] font-semibold rounded-[16px] shadow-sm transition-all duration-200
                        ${(loading || !isFormValid)
                            ? "bg-[#E5E5EA] text-[#8E8E93] cursor-not-allowed" // Disabled Style (Gray)
                            : "bg-[#007AFF] hover:bg-[#005bb5] text-white" // Enabled Style (Blue)
                        }
                    `}
                >
                    {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Continuer
                </Button>
            </div>
        </div>
    );
}
