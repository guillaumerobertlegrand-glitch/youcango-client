"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, MapPin, CheckCircle2, XCircle } from "lucide-react";
import mapboxgl from 'mapbox-gl';

// Mock Pro & Org Data (Ideally fetched from context/backend)
const PRO_ORG_LOCATION = { lat: 48.8566, lng: 2.3522 }; // Seed data location
const ALLOWED_RADIUS_METERS = 200; // Tolerance

export default function ProDashboard() {
    const [isOnline, setIsOnline] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

            /*
            // STRICT CHECK COMMENTED OUT FOR TESTING
            if (distance <= ALLOWED_RADIUS_METERS) {
                setIsOnline(true);
                setStatusMessage(`Présence confirmée (${Math.round(distance)}m). Vous êtes en ligne.`);
            } else {
                setIsOnline(false); // Revert
                setStatusMessage(`Trop loin du salon (${Math.round(distance)}m). Rapprochez-vous pour activer.`);
            }
            */

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
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 space-y-12 max-w-md mx-auto animate-in fade-in duration-700">

            {/* Big Status Indicator */}
            <div className="text-center space-y-4">
                <div className={`mx-auto h-32 w-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${isOnline ? 'bg-green-500 shadow-green-200' : 'bg-slate-100 shadow-slate-200'
                    }`}>
                    {isChecking ? (
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                    ) : isOnline ? (
                        <CheckCircle2 className="h-16 w-16 text-white animate-in zoom-in spin-in-12 duration-500" />
                    ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-300" />
                    )}
                </div>

                <h2 className={`text-2xl font-black tracking-tight transition-colors duration-300 ${isOnline ? 'text-green-600' : 'text-slate-300'
                    }`}>
                    {isChecking ? 'VÉRIFICATION...' : isOnline ? 'JE SUIS DISPONIBLE' : 'HORS LIGNE'}
                </h2>
            </div>

            {/* The ONE Toggle */}
            <div className="scale-150">
                <Switch
                    checked={isOnline}
                    onCheckedChange={handleToggle}
                    disabled={isChecking}
                    className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-200"
                />
            </div>

            {/* Feedback Message */}
            {statusMessage && (
                <div className={`text-sm font-bold text-center px-6 py-3 rounded-2xl animate-in fade-in slide-in-from-bottom-4 ${statusMessage.includes("Trop loin") || statusMessage.includes("Impossible")
                    ? 'bg-red-50 text-red-600'
                    : statusMessage.includes("Vérification")
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-green-50 text-green-600'
                    }`}>
                    {statusMessage.includes("Trop loin") && <MapPin className="inline-block mr-2 h-4 w-4" />}
                    {statusMessage}
                </div>
            )}

            {/* Hint */}
            {!isOnline && !isChecking && (
                <p className="text-center text-slate-400 text-xs font-medium max-w-[200px]">
                    Activez pour recevoir des demandes. Votre présence sur site sera vérifiée automatiquement.
                </p>
            )}

        </div>
    );
}
