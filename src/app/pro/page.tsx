"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/utils/supabase/client";

// Mock Pro & Org Data (Ideally fetched from context/backend)
const PRO_ORG_LOCATION = { lat: 48.8566, lng: 2.3522 }; // Seed data location
const ALLOWED_RADIUS_METERS = 200; // Tolerance

export default function ProDashboard() {
    const [isOnline, setIsOnline] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const supabase = createClient();

    const [demoInfo, setDemoInfo] = useState<{ orgName: string, proName: string } | null>(null);

    useEffect(() => {
        let mounted = true;
        async function checkStatus() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                console.log("[ProDashboard] Fetching Pro profile for user:", user.id);

                const { data: pro, error } = await supabase
                    .from('professionals')
                    .select('first_name, last_name, organization:organizations(onboarding_status, official_name)')
                    .eq('user_id', user.id)
                    .single();

                if (error) {
                    console.error("[ProDashboard] Fetch Error:", error);
                    if (error.code === 'PGRST116') {
                        console.warn("[ProDashboard] No professional profile found for this user.");
                    }
                    return;
                }

                if (mounted && pro && pro.organization) {
                    // @ts-ignore
                    const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;

                    console.log("[ProDashboard] Loaded Profile:", { org: org.official_name, pro: pro.first_name });

                    // Always set Info for the requested "Mode Démo" display
                    setDemoInfo({
                        orgName: org.official_name || "Organisation Inconnue",
                        proName: `${pro.first_name} ${pro.last_name || ''}`.trim()
                    });

                    if (org.onboarding_status !== 'completed') {
                        setIsDemoMode(true);
                    }
                }
            } catch (err: any) {
                console.error("[ProDashboard] Unexpected Exception:", err);
            }
        }
        checkStatus();
        return () => { mounted = false; };
    }, [supabase]);

    // Initial Load from LocalStorage
    useEffect(() => {
        const savedStatus = localStorage.getItem("pro_availability");
        if (savedStatus === "true") {
            setIsOnline(true);
            setStatusMessage("Disponibilité restaurée.");
        }
    }, []);

    // ... (HandleToggle and Helpers remain unchanged)
    const handleToggle = async (checked: boolean) => {
        if (!checked) {
            setIsOnline(false);
            localStorage.setItem("pro_availability", "false");
            setStatusMessage(null);
            return;
        }
        setIsChecking(true);
        setStatusMessage("Vérification de votre présence sur site...");
        try {
            const position = { coords: { latitude: PRO_ORG_LOCATION.lat, longitude: PRO_ORG_LOCATION.lng } } as GeolocationPosition;
            const distance = calculateDistance(
                position.coords.latitude,
                position.coords.longitude,
                PRO_ORG_LOCATION.lat,
                PRO_ORG_LOCATION.lng
            );
            await new Promise(r => setTimeout(r, 1500));
            setIsOnline(true);
            localStorage.setItem("pro_availability", "true");
            setStatusMessage(`[MODE TEST] Présence simulée (${Math.round(distance)}m).`);
        } catch (error) {
            console.error(error);
            setIsOnline(false);
            setStatusMessage("Impossible de localiser. Vérifiez vos permissions GPS.");
        } finally {
            setIsChecking(false);
        }
    };

    const getCurrentPosition = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation not supported"));
            } else {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
            }
        });
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-full p-6 space-y-8 w-full animate-in fade-in duration-700 bg-white relative">

            {/* Demo Banner - ALWAYS VISIBLE if info present (Requested) */}
            {demoInfo && (
                <div className="absolute top-0 w-full bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest font-semibold py-1.5 px-4 text-center border-b border-slate-100">
                    Mode Démo : {demoInfo.orgName} • {demoInfo.proName}
                </div>
            )}

            {/* Status Text (Simplified) */}
            <h2 className={`text-3xl font-bold tracking-tight transition-colors duration-300 text-center ${isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                {isChecking ? 'Checking...' : isOnline ? 'Available' : 'Unavailable'}
            </h2>

            {/* The ONE Toggle */}
            <div className="scale-150">
                <Switch
                    checked={isOnline}
                    onCheckedChange={handleToggle}
                    disabled={isChecking}
                    className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-200"
                />
            </div>
        </div>
    );
}
