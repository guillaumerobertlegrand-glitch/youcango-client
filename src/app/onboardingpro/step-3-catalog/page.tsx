"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step3CatalogPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [services, setServices] = useState<any[]>([]);

    // New Service Form
    const [newTitle, setNewTitle] = useState("");
    const [newDuration, setNewDuration] = useState(30);
    const [newPrice, setNewPrice] = useState(0);

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            const { data: pro } = await supabase.from('professionals').select('organization_id').eq('user_id', user.id).maybeSingle();
            if (pro) {
                setOrgId(pro.organization_id);
                fetchServices(pro.organization_id);
            } else {
                router.push("/onboardingpro");
            }
        }
        init();
    }, [router, supabase]);

    const fetchServices = async (oid: string) => {
        const { data } = await supabase.from('services').select('*').eq('organization_id', oid).eq('active', true);
        setServices(data || []);
        setLoading(false);
    };

    const addService = async () => {
        if (!orgId || !newTitle) return;

        // Convert integer minutes to interval string (e.g. '30 minutes')
        const intervalString = `${newDuration} minutes`;

        const { error } = await supabase.from('services').insert({
            organization_id: orgId,
            designation: newTitle, // Was title
            estimated_duration: intervalString, // Was duration_min/max
            price: newPrice, // Was price_amount
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

    const handleNext = async () => {
        if (!orgId) return;
        setLoading(true);

        const { data: result } = await supabase.rpc('api_v1_validate_onboarding_step', {
            p_step: 3,
            p_org_id: orgId
        });

        if (result.valid) {
            await supabase.from('organizations').update({ onboarding_step: 4 }).eq('id', orgId);
            router.push("/onboardingpro/step-4-team");
        } else {
            alert("Vous devez créer au moins un service actif.");
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">Étape 3 : Catalogue de Services</h1>
            <p className="text-gray-500">Ajoutez au moins une prestation pour continuer.</p>

            <div className="space-y-4 border p-6 rounded bg-white shadow-sm">
                <h3 className="font-semibold text-lg">Vos Services</h3>

                <div className="space-y-2">
                    {services.map(s => (
                        <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border">
                            <div>
                                <p className="font-medium">{s.designation}</p>
                                <p className="text-xs text-gray-500">
                                    {/* Display raw interval or parse it roughly if needed */}
                                    {s.estimated_duration} • {s.price}€
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
                        <input type="number" className="border p-2 rounded w-1/2" placeholder="Durée (min)" value={newDuration} onChange={e => setNewDuration(parseInt(e.target.value))} />
                        <input type="number" className="border p-2 rounded w-1/2" placeholder="Prix (€)" value={newPrice} onChange={e => setNewPrice(parseFloat(e.target.value))} />
                    </div>
                    <Button onClick={addService} variant="secondary" className="w-full flex gap-2 justify-center">
                        <Plus className="w-4 h-4" /> Ajouter Service
                    </Button>
                </div>
            </div>

            <Button onClick={handleNext} className="w-full" disabled={services.length === 0}>
                {services.length === 0 ? "Ajouter un service pour continuer" : "Valider & Suivant"}
            </Button>
        </div>
    );
}
