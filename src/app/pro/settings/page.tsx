"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea"; 
import { createClient } from "@/utils/supabase/client";

export default function ProSettingsPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Organization State
    const [orgId, setOrgId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [address, setAddress] = useState("");
    const [lat, setLat] = useState("");
    const [long, setLong] = useState("");

    useEffect(() => {
        fetchOrg();
    }, []);

    const fetchOrg = async () => {
        setLoading(true);
        const { data: orgs, error } = await supabase
            .from('organizations')
            .select(`
                id,
                name,
                category,
                description,
                locations (
                    address,
                    coordinates
                )
            `)
            .limit(1);

        if (orgs && orgs.length > 0) {
            const org = orgs[0];
            setOrgId(org.id);
            setName(org.name || "");
            setCategory(org.category || "");
            setDescription(org.description || "");

            // Extract Location Data
            if (org.locations && org.locations.length > 0) {
                const loc = org.locations[0];
                setAddress(loc.address || "");

                // Parse PostGIS coordinates (GeoJSON expected)
                // coordinates: { type: "Point", coordinates: [long, lat] }
                const coords = loc.coordinates as any;
                if (coords && coords.coordinates) {
                    setLong(coords.coordinates[0]?.toString() || "");
                    setLat(coords.coordinates[1]?.toString() || "");
                }
            }
        } else {
            console.error("No organization found", error);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!orgId) return;
        setSaving(true);

        const { data, error } = await supabase.rpc('api_v1_update_pro_profile', {
            p_org_id: orgId,
            p_name: name,
            p_category: category,
            p_description: description,
            p_address: address,
            p_lat: parseFloat(lat),
            p_long: parseFloat(long)
        });

        if (error) {
            alert("Error saving: " + error.message);
        } else {
            alert("Profile updated successfully!");
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading settings...</div>;

    return (
        <div className="p-6 max-w-lg mx-auto pb-40">
            <h1 className="text-2xl font-black text-slate-800 mb-2">Settings</h1>
            <p className="text-slate-500 mb-8">Manage your organization profile.</p>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-400">Organization Name</label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-white border-slate-200"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-400">Category (for Search)</label>
                    <Input
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g. Bakery, Hairdresser, Dentist..."
                        className="bg-white border-slate-200"
                    />
                    <p className="text-[10px] text-slate-400">
                        Help AI find you. Use simple English terms like 'bakery', 'barber'.
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-400">Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short tagline..."
                        className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-400">Postal Address</label>
                    <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="bg-white border-slate-200"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-400">Latitude</label>
                        <Input
                            value={lat}
                            onChange={(e) => setLat(e.target.value)}
                            className="bg-white border-slate-200 font-mono text-xs"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-400">Longitude</label>
                        <Input
                            value={long}
                            onChange={(e) => setLong(e.target.value)}
                            className="bg-white border-slate-200 font-mono text-xs"
                        />
                    </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800">
                    <strong>Tip:</strong> Changing GPS coordinates will instantly move your pin on the Client Map.
                </div>

                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl"
                >
                    {saving ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </div>
    );
}
