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
        <div className="flex flex-col min-h-full">
            <div className="flex-grow p-4 space-y-6">
                <header>
                    <h1 className="text-xl font-bold text-slate-900">
                        {isRestaurant ? "Votre Offre" : "Catalogue"}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isRestaurant
                            ? "Définissez le profil de votre établissement."
                            : "Ajoutez au moins une prestation pour continuer."}
                    </p>
                </header>

                {isRestaurant ? (
                    /* RESTAURANT MODE UI */
                    <div className="space-y-4">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
                            <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wider">Cuisine</h3>

                            {/* Specialty Selector */}
                            <select
                                className="w-full border p-3 rounded-lg bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                value={selectedSpecialty}
                                onChange={e => setSelectedSpecialty(e.target.value)}
                            >
                                <option value="">Choisir une spécialité...</option>
                                {specialties.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                            {specialties.length === 0 && <p className="text-xs text-slate-400">Chargement des types de cuisine...</p>}
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
                            <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wider text-center">Gamme de Prix</h3>
                            <div className="flex justify-between px-2">
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setPriceRange(level)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200
                                            ${priceRange === level
                                                ? 'bg-black text-white shadow-lg scale-110'
                                                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        {Array(level).fill('€').join('')}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 px-2 uppercase font-medium">
                                <span>Éco</span>
                                <span>Luxe</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* SERVICE/BEAUTY MODE UI */
                    <div className="space-y-4">
                        {/* List */}
                        <div className="space-y-3">
                            {services.map(s => (
                                <div key={s.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm animate-in slide-in-from-bottom-2">
                                    <div>
                                        <p className="font-medium text-slate-900">{s.designation}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {s.estimated_duration}
                                            </span>
                                            {s.price > 0 && (
                                                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Banknote className="w-3 h-3" /> {s.price}€
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => deleteService(s.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full h-8 w-8">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {services.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                                    <p className="text-sm text-slate-400">Aucun service pour le moment.</p>
                                </div>
                            )}
                        </div>

                        {/* Add Form */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900">Nouveau Service</h3>
                            <input
                                className="w-full border p-3 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                placeholder="Nom (ex: Coupe Homme)"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                            <div className="flex gap-3">
                                <div className="relative w-1/2">
                                    <input type="number" className="w-full border p-3 pl-9 rounded-lg bg-white outline-none" placeholder="30" value={newDuration || ""} onChange={e => setNewDuration(parseInt(e.target.value) || 0)} />
                                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                </div>
                                <div className="relative w-1/2">
                                    <input type="number" className="w-full border p-3 pl-9 rounded-lg bg-white outline-none" placeholder="Prix" value={newPrice || ""} onChange={e => setNewPrice(parseFloat(e.target.value) || 0)} />
                                    <Banknote className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                </div>
                            </div>
                            <Button onClick={addService} className="w-full bg-slate-900 text-white hover:bg-black" disabled={!newTitle}>
                                <Plus className="w-4 h-4 mr-2" /> Ajouter
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-100 pb-8">
                <Button onClick={handleNext} className="w-full h-12 text-base font-semibold shadow-xl shadow-slate-200" disabled={loading || (!isRestaurant && services.length === 0)}>
                    {loading ? <Loader2 className="animate-spin mr-2" /> : "Suivant"}
                </Button>
            </div>
        </div>
    );
}
