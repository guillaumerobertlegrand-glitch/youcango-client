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

    // Check Onboarding Status
    useEffect(() => {
        async function checkStatus() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: pro } = await supabase
                .from('professionals')
                .select('organization:organizations(onboarding_status)')
                .eq('user_id', user.id)
                .single();

            if (pro && pro.organization) {
                // @ts-ignore
                const org = Array.isArray(pro.organization) ? pro.organization[0] : pro.organization;
                if (org && org.onboarding_status !== 'completed') {
                    setIsDemoMode(true);
                }
            }
        }
        checkStatus();
    }, [supabase]);

    // Initial Load from LocalStorage
    useEffect(() => {
        const savedStatus = localStorage.getItem("pro_availability");
        if (savedStatus === "true") {
            setIsOnline(true);
            setStatusMessage("Disponibilité restaurée.");
        }
    }, []);

    // Handle Toggle Change
    const handleToggle = async (checked: boolean) => {
        if (!checked) {
            // Deactivation is simple
            setIsOnline(false);
            localStorage.setItem("pro_availability", "false");
            setStatusMessage(null);
            return;
        }

        // Activation requires Presence Check
        setIsChecking(true);
        setStatusMessage("Vérification de votre présence sur site...");

        try {
            // 1. Get User Location
            // [TEST MODE] Mocked for instant feedback
            // const position = await getCurrentPosition();
            const position = { coords: { latitude: PRO_ORG_LOCATION.lat, longitude: PRO_ORG_LOCATION.lng } } as GeolocationPosition;

            // 2. Compare with Org Location
            const distance = calculateDistance(
                position.coords.latitude,
                position.coords.longitude,
                PRO_ORG_LOCATION.lat,
                PRO_ORG_LOCATION.lng
            );

            // 3. Simulate Network Delay for UX
            await new Promise(r => setTimeout(r, 1500));

            // BYPASS FOR TESTING
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

    // Helper: Promisified Geolocation
    const getCurrentPosition = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation not supported"));
            } else {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
            }
        });
    };

    // Helper: Haversine Distance (Meters)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };


    return (
        <div className="flex flex-col items-center justify-center min-h-full p-6 space-y-8 w-full animate-in fade-in duration-700 bg-white relative">

            {/* Demo Banner */}
            {isDemoMode && (
                <div className="absolute top-0 w-full bg-yellow-100 text-yellow-800 text-xs font-semibold py-1 px-4 text-center border-b border-yellow-200">
                    Mode Démo : Configuration incomplète. Données simulées.
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
