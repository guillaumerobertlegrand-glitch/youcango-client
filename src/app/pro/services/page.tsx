"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Service {
    id: string;
    title: string;
    duration_min: number;
    price_amount: number;
    active: boolean;
}

export default function ProServicesPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<Service[]>([]);
    const [orgId, setOrgId] = useState<string | null>(null);

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formTitle, setFormTitle] = useState("");
    const [formPrice, setFormPrice] = useState("");
    const [formDuration, setFormDuration] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // 1. Fetch Org
        const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
        if (orgs && orgs[0]) {
            setOrgId(orgs[0].id);
            // 2. Fetch Services
            const { data: svcs } = await supabase
                .from('services')
                .select('*')
                .eq('organization_id', orgs[0].id)
                .eq('active', true)
                .order('title');

            if (svcs) setServices(svcs);
        }
        setLoading(false);
    };

    const handleEdit = (svc: Service) => {
        setEditId(svc.id);
        setFormTitle(svc.title);
        setFormPrice(svc.price_amount?.toString() || "");
        setFormDuration(svc.duration_min?.toString() || "");
        setIsEditing(true);
    };

    const handleNew = () => {
        setEditId(null);
        setFormTitle("");
        setFormPrice("");
        setFormDuration("");
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditId(null);
    };

    const handleSave = async () => {
        if (!orgId) return;
        if (!formTitle || !formPrice || !formDuration) {
            alert("Please fill all fields");
            return;
        }

        const payload = {
            title: formTitle,
            price_amount: parseFloat(formPrice),
            duration_min: parseInt(formDuration),
            duration_max: parseInt(formDuration), // Simple fixed duration for now
            organization_id: orgId,
            price_currency: 'EUR', // Default
            active: true
        };

        let error;
        if (editId) {
            // Update
            const res = await supabase.from('services').update(payload).eq('id', editId);
            error = res.error;
        } else {
            // Create
            const res = await supabase.from('services').insert(payload);
            error = res.error;
        }

        if (error) {
            alert("Error: " + error.message);
        } else {
            setIsEditing(false);
            fetchData(); // Refresh
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this service?")) return;

        // Soft delete
        const { error } = await supabase
            .from('services')
            .update({ active: false })
            .eq('id', id);

        if (error) alert("Error deleting: " + error.message);
        else fetchData();
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading catalog...</div>;

    return (
        <div className="p-6 max-w-lg mx-auto pb-40">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Services</h1>
                    <p className="text-slate-500 text-sm">Manage your price list.</p>
                </div>
                {!isEditing && (
                    <Button onClick={handleNew} className="rounded-full bg-slate-900 h-10 w-10 p-0 shadow-lg">
                        <Plus size={20} />
                    </Button>
                )}
            </div>

            {isEditing ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in zoom-in-95 duration-200">
                    <h2 className="text-lg font-bold mb-4">{editId ? "Edit Service" : "New Service"}</h2>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-400">Title</label>
                            <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Men's Haircut" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-400">Price (€)</label>
                                <Input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-400">Duration (min)</label>
                                <Input type="number" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button onClick={handleCancel} variant="ghost" className="flex-1">Cancel</Button>
                            <Button onClick={handleSave} className="flex-1 bg-slate-900 text-white font-bold">Save</Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {services.length === 0 && (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-400 mb-4">No services yet.</p>
                            <Button onClick={handleNew} variant="outline">Create your first service</Button>
                        </div>
                    )}

                    {services.map((svc) => (
                        <div key={svc.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
                            <div>
                                <h3 className="font-bold text-slate-800">{svc.title}</h3>
                                <div className="text-xs text-slate-400 font-medium">
                                    {svc.duration_min} min • <span className="text-slate-900">{svc.price_amount}€</span>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button onClick={() => handleEdit(svc)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500">
                                    <Edit2 size={16} />
                                </Button>
                                <Button onClick={() => handleDelete(svc.id)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500">
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
