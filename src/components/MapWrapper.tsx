"use client";

import Map, { Marker, Popup, NavigationControl, GeolocateControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useMemo, useRef } from "react";
import { Zap, MapPin, Store as StoreIcon, Clock, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import LockTimer from "./LockTimer";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface Store {
    id: string;
    name: string;
    business_type: 'service' | 'merchant';
    category?: string;
    address?: string;
    lat: number;
    long: number;
    dist_meters: number;
}

interface MapWrapperProps {
    intentData?: {
        category: string;
        keywords: string[];
        primary_business_type: string;
    } | null;
    onLoadingChange?: (loading: boolean) => void;
}

const PARIS_FALLBACK = { lat: 48.8566, long: 2.3522 };

export default function MapWrapper({ intentData, onLoadingChange }: MapWrapperProps) {
    const supabase = createClient();
    const [viewState, setViewState] = useState({
        latitude: PARIS_FALLBACK.lat,
        longitude: PARIS_FALLBACK.long,
        zoom: 13,
    });

    const [stores, setStores] = useState<Store[]>([]);
    const [lastZoomedStoresId, setLastZoomedStoresId] = useState<string>("");
    const mapRef = useRef<any>(null);
    const [selectedStore, setSelectedStore] = useState<Store | null>(null);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [isLocking, setIsLocking] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; long: number } | null>(null);
    const [arrivalTiming, setArrivalTiming] = useState(15);

    // Safety refs to track search state and avoid infinite loops
    const lastExecutionRef = useRef<string>("");
    const isComponentMounted = useRef(true);
    const activeRequestsRef = useRef(0);

    useEffect(() => {
        isComponentMounted.current = true;
        return () => { isComponentMounted.current = false; };
    }, []);

    // 1. Stable Geolocation
    useEffect(() => {
        if (!navigator.geolocation) {
            setUserLocation(PARIS_FALLBACK);
            return;
        }

        const handleSuccess = (pos: GeolocationPosition) => {
            if (!isComponentMounted.current) return;
            const { latitude, longitude } = pos.coords;
            setUserLocation(prev => {
                const hasSignificantDiff = !prev || Math.abs(prev.lat - latitude) > 0.001 || Math.abs(prev.long - longitude) > 0.001;
                return hasSignificantDiff ? { lat: latitude, long: longitude } : prev;
            });
            setViewState(prev => (prev.latitude === PARIS_FALLBACK.lat ? { ...prev, latitude, longitude } : prev));
        };

        const handleError = (err: GeolocationPositionError) => {
            if (!isComponentMounted.current) return;
            console.warn("[Geolocation Logic] Error:", err.message);
            setUserLocation(prev => prev || PARIS_FALLBACK);
        };

        // Get initial position
        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, { timeout: 5000 });

        // Watch for movements (low accuracy for battery/stability)
        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000
        });

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // 2. Stabilized Fetch Effect
    useEffect(() => {
        let isEffectAlive = true;
        const requestId = Math.random().toString(36).substring(7);

        console.log(`[C2 Search][${requestId}] Effect initialized. Mapbox Token: ${!!MAPBOX_TOKEN}`);

        const fetchMerchants = async () => {
            if (!intentData?.category) {
                console.log(`[C2 Search][${requestId}] No category, skipping.`);
                onLoadingChange?.(false);
                return;
            }

            const lat = userLocation?.lat || PARIS_FALLBACK.lat;
            const long = userLocation?.long || PARIS_FALLBACK.long;
            const currentParams = `${intentData.category}-${JSON.stringify(intentData.keywords)}-${lat.toFixed(3)}-${long.toFixed(3)}`;

            // Safety Backup: Force unlock UI after 7 seconds no matter what
            const safetyUnlock = setTimeout(() => {
                if (isEffectAlive) {
                    console.warn(`[C2 Search][${requestId}] Safety unlock triggered after 7s.`);
                    onLoadingChange?.(false);
                }
            }, 7000);

            // PROTECT: Don't search if params haven't changed and we already have results
            if (lastExecutionRef.current === currentParams && stores.length > 0) {
                console.log(`[C2 Search][${requestId}] Params unchanged, skipping.`);
                clearTimeout(safetyUnlock);
                onLoadingChange?.(false);
                return;
            }

            console.log(`[C2 Search][${requestId}] Request START: ${currentParams}`);
            activeRequestsRef.current += 1;
            onLoadingChange?.(true);

            try {
                // RPC with 20s Timeout
                const rpcPromise = supabase.rpc('api_v1_get_merchants', {
                    p_lat: lat,
                    p_long: long,
                    p_category: intentData.category,
                    p_keywords: intentData.keywords || []
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("RPC Timeout 20s")), 20000)
                );

                const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

                if (!isEffectAlive || !isComponentMounted.current) {
                    console.log(`[C2 Search][${requestId}] Request finished but component unmounted.`);
                    return;
                }

                if (error) {
                    console.error(`[C2 Search][${requestId}] RPC Error:`, error.message);
                } else if (data) {
                    console.log(`[C2 Search][${requestId}] RPC SUCCESS: ${data.length} stores.`);
                    setStores(data as Store[]);
                    lastExecutionRef.current = currentParams;
                }
            } catch (e: any) {
                console.error(`[C2 Search][${requestId}] EXCEPTION:`, e.message);
            } finally {
                clearTimeout(safetyUnlock);
                activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
                console.log(`[C2 Search][${requestId}] Request FINISHED. Active requests: ${activeRequestsRef.current}`);

                // Only signal 'false' if NO MORE requests are pending
                if (activeRequestsRef.current === 0) {
                    onLoadingChange?.(false);
                }
            }
        };

        fetchMerchants();
        return () => { isEffectAlive = false; };
        // We only re-trigger on CATEGORY/KEYWORDS changes or when location FIRST arrives
    }, [intentData?.category, JSON.stringify(intentData?.keywords || []), !!userLocation]);

    // 3. Dynamic Zoom & Centering logic (Triggered ONCE per results set)
    useEffect(() => {
        if (stores.length === 0 || !userLocation || !mapRef.current) return;

        const currentStoresId = stores.map(s => s.id).join(',');
        if (lastZoomedStoresId === currentStoresId) return;

        const topOptions = stores.slice(0, 4);
        const maxDistMeters = Math.max(...topOptions.map(s => s.dist_meters || 0));

        // Calculate ideal zoom: continuous formula for better sensitivity
        // Zoom 17.5 ~= 85m radius | Zoom 15 ~= 500m radius | Zoom 13.5 ~= 1.5km radius
        const referenceDist = 500;
        const referenceZoom = 15;

        // Ensure maxDistMeters is at least 50m to avoid over-zooming
        const effectiveDist = Math.max(maxDistMeters, 50);
        const idealZoom = referenceZoom - Math.log2(effectiveDist / referenceDist);

        const finalZoom = Math.min(Math.max(idealZoom, 11), 17.5);
        console.log(`[C2 UX] Progressive flying to zoom ${finalZoom.toFixed(1)} (max dist: ${Math.round(maxDistMeters)}m)`);

        // Use flyTo for robust, direct control
        mapRef.current.flyTo({
            center: [userLocation.long, userLocation.lat],
            zoom: finalZoom,
            duration: 1500,
            essential: true
        });

        setLastZoomedStoresId(currentStoresId);

    }, [stores, !!userLocation, !!mapRef.current]);

    const handleLock = async () => {
        if (!selectedStore) return;
        setIsLocking(true);

        const monetizationModel = selectedStore.business_type === 'service' ? 'commission' : 'subscription';

        // CALL RPC instead of Server Action
        const { data, error } = await supabase.rpc('api_v1_create_session', {
            p_location_id: selectedStore.id,
            p_monetization_model: monetizationModel,
            p_arrival_timing_minutes: arrivalTiming
        });

        if (data?.session_id) {
            setActiveSession({ id: data.session_id });
        } else {
            console.error("Lock error:", error);
            setIsLocking(false);
        }
    };

    const handleCancelLock = async () => {
        if (activeSession) {
            await supabase.from('sessions').update({ state: 'cancelled' }).eq('id', activeSession.id);
        }
        setActiveSession(null);
        setIsLocking(false);
        setIsRevealed(false);
        setSelectedStore(null);
    };

    const handleLockExpired = async () => {
        if (activeSession) {
            await supabase.from('sessions').update({ state: 'pending' }).eq('id', activeSession.id);
            setIsRevealed(true);
        }
        setIsLocking(false);
    };

    const handleArrival = async () => {
        if (activeSession) {
            await supabase.from('sessions').update({ state: 'completed' }).eq('id', activeSession.id);
        }
        setIsRevealed(false);
        setActiveSession(null);
        setSelectedStore(null);
    };

    return (
        <div className="w-full h-full relative">
            <Map
                {...viewState}
                ref={mapRef}
                onMove={(evt) => setViewState(evt.viewState)}
                style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
            >
                <GeolocateControl position="top-left" />
                <NavigationControl position="top-left" />

                {/* User Location */}
                {userLocation && (
                    <Marker longitude={userLocation.long} latitude={userLocation.lat} anchor="bottom">
                        <div className="relative flex items-center justify-center h-16 w-16 group">
                            <div className="absolute animate-ping inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></div>
                            <div className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white shadow-lg"></div>
                        </div>
                    </Marker>
                )}

                {/* Store Markers */}
                {stores.map((store, index) => (
                    <Marker
                        key={store.id}
                        longitude={store.long}
                        latitude={store.lat}
                        anchor="bottom"
                        onClick={(e) => {
                            e.originalEvent.stopPropagation();
                            setSelectedStore(store);
                        }}
                    >
                        <div className="cursor-pointer transition-transform hover:scale-110 relative group">
                            {store.business_type === 'service' ? (
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-600 text-white shadow-lg border-2 border-white font-bold text-sm">
                                    {index + 1}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-orange-500 text-white shadow-lg border-2 border-white font-bold text-sm">
                                    {index + 1}
                                </div>
                            )}
                        </div>
                    </Marker>
                ))}

                {selectedStore && (
                    <Popup
                        longitude={selectedStore.long}
                        latitude={selectedStore.lat}
                        anchor="top"
                        onClose={() => {
                            if (!isLocking && !isRevealed) setSelectedStore(null);
                        }}
                        closeButton={false}
                        className="z-50"
                    >
                        <div className="p-4 min-w-[220px] text-center space-y-4">
                            {isRevealed ? (
                                <div className="space-y-3">
                                    <div className="flex flex-col items-center">
                                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                                            <Navigation className="text-blue-600" size={24} />
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900">{selectedStore.name}</h3>
                                        <p className="text-xs text-slate-500">{selectedStore.address}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl"
                                        onClick={handleArrival}
                                    >
                                        Je suis arrivé !
                                    </Button>
                                </div>
                            ) : !isLocking ? (
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-900 italic">
                                            {(selectedStore.category || selectedStore.business_type).charAt(0).toUpperCase() + (selectedStore.category || selectedStore.business_type).slice(1)} {stores.findIndex(s => s.id === selectedStore.id) + 1}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                            {selectedStore.dist_meters ? `${Math.round(selectedStore.dist_meters)}m • ` : ''}
                                            Disponible
                                        </p>
                                    </div>


                                    <Button
                                        size="sm"
                                        className="w-full h-10 bg-black text-white hover:bg-slate-800 rounded-xl transition-all shadow-md flex items-center gap-2 group"
                                        onClick={handleLock}
                                    >
                                        <Zap size={14} className="group-hover:animate-pulse" />
                                        <span>Lock Destination</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="py-4">
                                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                                    <p className="text-xs font-bold text-blue-600 animate-pulse uppercase tracking-wider">Engagement en cours...</p>
                                </div>
                            )}
                        </div>
                    </Popup>
                )}
            </Map>

            {isLocking && (
                <LockTimer
                    duration={60}
                    onCancel={handleCancelLock}
                    onExpire={handleLockExpired}
                />
            )}
        </div>
    );
}
