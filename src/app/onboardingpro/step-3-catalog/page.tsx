"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Clock, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IOSSection, IOSRow } from "@/components/ui/ios-settings";
import { cn } from "@/lib/utils";

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

                // Fetch Services regardless
                fetchServices(pro.organization_id);
            } else {
                router.push("/onboardingpro");
            }
        }
        init();
    }, [router, supabase]);

    // Fetch Specialties if Restaurant
    useEffect(() => {
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
        // Only set loading false once we have everything we need logic-wise. 
        // But here waiting for specialties is separate effect. 
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
            // Keep previous duration/price as sticky defaults or reset?
            // User likely adds similar services, keeping them is nice UX.
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

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-500" /></div>;

    return (
        <div className="h-full font-sans bg-[#F2F2F7] relative overflow-hidden flex flex-col">

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-6">

                {/* Header */}
                <header className="mt-10 px-6 mb-2">
                    <h1 className="text-[22px] font-bold text-black tracking-tight">
                        {isRestaurant ? "Votre Offre" : "Catalogue"}
                    </h1>
                    <p className="text-[17px] text-[#000000] mt-2 leading-relaxed">
                        {isRestaurant
                            ? "Définissez le profil de votre établissement."
                            : "Ajoutez vos prestations pour continuer."}
                    </p>
                </header>

                {isRestaurant ? (
                    <>
                        <IOSSection title="Cuisine">
                            {/* Native Select styled as Text */}
                            <IOSRow label="Spécialité" separator={false}>
                                <select
                                    className={cn(
                                        "appearance-none bg-transparent text-[17px] font-normal outline-none cursor-pointer text-right",
                                        selectedSpecialty ? "text-[#3C3C43]" : "text-[#8E8E93]"
                                    )}
                                    value={selectedSpecialty}
                                    onChange={e => setSelectedSpecialty(e.target.value)}
                                    style={{ direction: 'rtl', width: '100%' }}
                                >
                                    <option value="" disabled>Choisir...</option>
                                    {specialties.map(s => (
                                        <option key={s.id} value={s.id} className="text-black text-left" style={{ direction: 'ltr' }}>{s.label}</option>
                                    ))}
                                </select>
                            </IOSRow>
                        </IOSSection>

                        <IOSSection title="Gamme de prix">
                            <div className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between px-2">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setPriceRange(level)}
                                            className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 tracking-tighter text-[11px]",
                                                priceRange === level
                                                    ? "bg-black text-white shadow-md scale-110"
                                                    : "bg-[#E5E5EA] text-[#8E8E93] hover:bg-[#D1D1D6]"
                                            )}
                                        >
                                            {Array(level).fill('€').join('')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </IOSSection>
                    </>
                ) : (
                    <>
                        {/* List Existing Services */}
                        {services.length > 0 && (
                            <IOSSection title="VOS SERVICES">
                                {services.map((s, idx) => (
                                    <IOSRow
                                        key={s.id}
                                        label={s.designation}
                                        separator={idx !== services.length - 1} // No separator for last item
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-[17px] text-[#8E8E93]">{s.estimated_duration}</span>
                                            <span className="text-[17px] text-black font-medium w-12 text-right">{s.price}€</span>
                                            <button
                                                onClick={() => deleteService(s.id)}
                                                className="ml-2 w-8 h-8 flex items-center justify-center bg-red-50 rounded-full text-red-500 active:bg-red-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </IOSRow>
                                ))}
                            </IOSSection>
                        )}

                        {/* Add New Service */}
                        <IOSSection title="NOUVEAU SERVICE">
                            <IOSRow label="Nom" separator={true}>
                                <input
                                    className="w-full text-right bg-transparent outline-none text-[17px] text-black placeholder:text-[#C7C7CC]"
                                    placeholder="Ex: Coupe Homme"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                />
                            </IOSRow>
                            <IOSRow label="Durée (min)" separator={true}>
                                <input
                                    type="number"
                                    className="w-full text-right bg-transparent outline-none text-[17px] text-black placeholder:text-[#C7C7CC]"
                                    placeholder="30"
                                    value={newDuration || ""}
                                    onChange={e => setNewDuration(parseInt(e.target.value) || 0)}
                                />
                            </IOSRow>
                            <IOSRow label="Prix (€)" separator={true}>
                                <input
                                    type="number"
                                    className="w-full text-right bg-transparent outline-none text-[17px] text-black placeholder:text-[#C7C7CC]"
                                    placeholder="0"
                                    value={newPrice || ""}
                                    onChange={e => setNewPrice(parseFloat(e.target.value) || 0)}
                                />
                            </IOSRow>

                            {/* Action Button embedded in section footer-like area or just a padded div */}
                            <div className="p-4">
                                <Button
                                    onClick={addService}
                                    className="w-full bg-black text-white font-semibold h-11 rounded-[14px]"
                                    disabled={!newTitle}
                                >
                                    <Plus className="w-5 h-5 mr-2" /> Ajouter
                                </Button>
                            </div>
                        </IOSSection>
                    </>
                )}
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 z-10 relative mt-auto pb-6 pt-2 bg-[#F2F2F7]/80 backdrop-blur-md border-t border-[#C6C6C8]/30">
                <div className="px-4">
                    <Button
                        onClick={handleNext}
                        className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-bold text-[17px] h-12 rounded-[16px]"
                        disabled={loading || (!isRestaurant && services.length === 0)}
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : "Continuer"}
                    </Button>
                </div>
            </div>

        </div>
    );
}
