"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Banknote, Clock, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step3CatalogPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [apeCode, setApeCode] = useState<string | null>(null);

    // Mode: Restaurant
    const [priceRange, setPriceRange] = useState<number | null>(null);
    const [specialties, setSpecialties] = useState<any[]>([]);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");

    // Mode: Service
    const [services, setServices] = useState<any[]>([]);
    const [newTitle, setNewTitle] = useState("");
    const [newDuration, setNewDuration] = useState(30);
    const [newPrice, setNewPrice] = useState(0);

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            const { data: pro } = await supabase.from('professionals')
                .select('organization_id, organization:organizations(ape_code, price_range, specialty_id)')
                .eq('user_id', user.id)
                .maybeSingle();

            if (pro) {
                setOrgId(pro.organization_id);
                // @ts-ignore
                const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;
                if (org) {
                    setApeCode(org.ape_code);
                    if (org.price_range) setPriceRange(org.price_range);
                    if (org.specialty_id) setSelectedSpecialty(org.specialty_id);
                }

                // Fetch Services regardless, in case they switch or logic overlaps
                fetchServices(pro.organization_id);
            } else {
                router.push("/onboardingpro");
            }
        }
        init();
    }, [router, supabase]);

    // Fetch Specialties if Restaurant
    useEffect(() => {
        // Simple check: if APE starts with 56 (digits only check)
        if (!apeCode || !apeCode.replace('.', '').startsWith('56')) {
            setSpecialties([]);
            return;
        }

        async function loadSpecialties() {
            const prefix = '56'; // Direct Restaurant Prefix for now
            const { data } = await supabase.from('config_specialties').select('id, label').eq('industry_prefix', prefix);
            setSpecialties(data || []);
        }
        loadSpecialties();
    }, [apeCode, supabase]);


    const fetchServices = async (oid: string) => {
        const { data } = await supabase.from('services').select('*').eq('organization_id', oid).eq('active', true);
        setServices(data || []);
        setLoading(false);
    };

    const isRestaurant = apeCode?.replace('.', '').startsWith('56');

    // --- Service Mode Logic ---
    const addService = async () => {
        if (!orgId || !newTitle) return;
        const intervalString = `${newDuration} minutes`;
        const { error } = await supabase.from('services').insert({
            organization_id: orgId,
            designation: newTitle,
            estimated_duration: intervalString,
            price: newPrice,
            active: true
        });
        if (error) alert("Erreur: " + error.message);
        else {
            setNewTitle("");
            fetchServices(orgId);
        }
    };

    const deleteService = async (id: string) => {
        await supabase.from('services').update({ active: false }).eq('id', id);
        if (orgId) fetchServices(orgId);
    };

    // --- Navigation & Validation ---
    const handleNext = async () => {
        if (!orgId) return;
        setLoading(true);

        // For Restaurant: Save global settings first
        if (isRestaurant) {
            if (!priceRange) {
                alert("Veuillez définir une gamme de prix.");
                setLoading(false);
                return;
            }
            if (!selectedSpecialty && specialties.length > 0) {
                alert("Veuillez sélectionner une spécialité (type de cuisine).");
                setLoading(false);
                return;
            }

            const { error } = await supabase.from('organizations').update({
                price_range: priceRange,
                specialty_id: selectedSpecialty || null
            }).eq('id', orgId);

            if (error) {
                alert("Erreur de sauvegarde: " + error.message);
                setLoading(false);
                return;
            }
        }

        // Validate via RPC
        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', {
            p_step: 3,
            p_org_id: orgId
        });

        if (result.valid) {
            await supabase.from('organizations').update({ onboarding_step: 4 }).eq('id', orgId);
            router.push("/onboardingpro/step-4-team");
        } else {
            alert(isRestaurant ? "Veuillez remplir les informations requises." : "Vous devez créer au moins un service actif.");
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">Étape 3 : {isRestaurant ? "Votre Offre" : "Catalogue de Services"}</h1>
            <p className="text-gray-500">
                {isRestaurant
                    ? "Définissez le profil de votre établissement."
                    : "Ajoutez au moins une prestation pour continuer."}
            </p>

            {isRestaurant ? (
                /* RESTAURANT MODE UI */
                <div className="space-y-6 border p-6 rounded bg-white shadow-sm">
                    <h3 className="font-semibold text-center text-gray-700 bg-gray-50 p-2 rounded">Profil de votre établissement</h3>

                    {/* Specialty Selector */}
                    {specialties.length > 0 && (
                        <div className="space-y-2 max-w-xs mx-auto">
                            <label className="font-semibold block text-sm text-center">Type de Cuisine</label>
                            <select
                                className="w-full border p-2 rounded text-center"
                                value={selectedSpecialty}
                                onChange={e => setSelectedSpecialty(e.target.value)}
                            >
                                <option value="">Choisir une spécialité...</option>
                                {specialties.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-4 text-center border-t pt-4">
                        <label className="font-semibold flex items-center justify-center gap-2 text-sm">
                            Gamme de Prix
                        </label>
                        <div className="flex justify-center gap-3">
                            {[1, 2, 3, 4, 5].map((level) => (
                                <button
                                    key={level}
                                    onClick={() => setPriceRange(level)}
                                    className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-300
                                        ${priceRange === level
                                            ? 'border-indigo-600 bg-indigo-600 text-white scale-110 shadow-md ring-2 ring-indigo-200'
                                            : 'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-400'}`}
                                >
                                    {Array(level).fill('€').join('')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                /* SERVICE/BEAUTY MODE UI */
                <div className="space-y-4 border p-6 rounded bg-white shadow-sm">
                    <h3 className="font-semibold text-lg">Vos Prestations</h3>

                    <div className="space-y-2">
                        {services.map(s => (
                            <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border">
                                <div>
                                    <p className="font-medium">{s.designation}</p>
                                    <p className="text-xs text-gray-500">
                                        {s.estimated_duration} • {s.price > 0 ? `${s.price}€` : "Prix sur devis / variable"}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => deleteService(s.id)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </div>
                        ))}
                        {services.length === 0 && <p className="text-sm text-gray-400 italic">Aucun service créé.</p>}
                    </div>

                    <div className="mt-4 pt-4 border-t grid gap-3">
                        <input className="border p-2 rounded" placeholder="Nom du service (ex: Coupe Homme)" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                        <div className="flex gap-2">
                            <input type="number" className="border p-2 rounded w-1/2" placeholder="Durée (min)" value={newDuration || ""} onChange={e => setNewDuration(parseInt(e.target.value) || 0)} />
                            <input type="number" className="border p-2 rounded w-1/2" placeholder="Prix (Optionnel)" value={newPrice || ""} onChange={e => setNewPrice(parseFloat(e.target.value) || 0)} />
                        </div>
                        <Button onClick={addService} variant="secondary" className="w-full flex gap-2 justify-center">
                            <Plus className="w-4 h-4" /> Ajouter Service
                        </Button>
                    </div>
                </div>
            )}

            <Button onClick={handleNext} className="w-full" disabled={loading || (!isRestaurant && services.length === 0)}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : "Valider & Suivant"}
            </Button>
        </div>
    );
}
