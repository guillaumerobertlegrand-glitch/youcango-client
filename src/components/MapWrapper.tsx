"use client";

import Map, { Marker, Popup, NavigationControl, GeolocateControl, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { Zap, MapPin, Store as StoreIcon, Clock, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

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
    location_id: string; // Needed for Session creation
}

interface MapWrapperProps {
    intentData?: {
        category: string;
        keywords: string[];
        primary_business_type: string;
        extracted_category?: string;
    } | null;
    onLoadingChange?: (loading: boolean) => void;
    onGuidanceStateChange?: (guiding: boolean) => void;
    onLockingChange?: (locking: boolean) => void;
    onLockProgress?: (progress: number) => void;
    onStoreSelected?: (store: Store | null) => void;
    onRouteInfoUpdate?: (info: { distance: number; duration: number } | null) => void;
    unifiedMode?: boolean;
}

const PARIS_FALLBACK = { lat: 48.8566, long: 2.3522 };

const MapWrapper = forwardRef<any, MapWrapperProps>(({
    intentData,
    onLoadingChange,
    onGuidanceStateChange,
    onLockingChange,
    onLockProgress,
    onStoreSelected,
    onRouteInfoUpdate,
    unifiedMode
}, ref) => {
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
    const activeSessionRef = useRef<any>(null);
    const [isLocking, setIsLocking] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; long: number } | null>(null);
    const [arrivalTiming, setArrivalTiming] = useState(15);
    const [routeData, setRouteData] = useState<any>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

    // Timer logic for locking (C3)
    useEffect(() => {
        let timer: any;
        if (isLocking) {
            let timeLeft = 10;
            onLockProgress?.(100);

            timer = setInterval(() => {
                timeLeft -= 0.1;
                const progress = (timeLeft / 10) * 100;
                onLockProgress?.(Math.max(0, progress));

                if (timeLeft <= 0) {
                    clearInterval(timer);
                    handleLockExpired();
                }
            }, 100);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [isLocking]);

    // Safety refs to track search state and avoid infinite loops
    const lastExecutionRef = useRef<string>("");

    useImperativeHandle(ref, () => ({
        cancelLock: () => handleCancelLock(),
        handleArrival: () => handleArrival()
    }));
    const isComponentMounted = useRef(true);
    const activeRequestsRef = useRef(0);

    useEffect(() => {
        isComponentMounted.current = true;
        return () => { isComponentMounted.current = false; };
    }, []);

    // 1. Stable Geolocation
    useEffect(() => {
        // [DEMO MODE] Force Paris location to see Seed Data (Dandy Barber)
        // Ignoring real GPS for now because user might be far away
        console.log("[MapWrapper] Forcing Mock Location (Paris) for Demo");
        setUserLocation(PARIS_FALLBACK);

        /* 
        // Real Geolocation Logic (Restorable later)
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

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, { timeout: 5000 });
        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000
        });
        return () => navigator.geolocation.clearWatch(watchId);
        */
    }, []);

    // 2. Stabilized Fetch Effect
    useEffect(() => {
        let isEffectAlive = true;
        const requestId = Math.random().toString(36).substring(7);

        const fetchMerchants = async () => {
            if (!intentData?.category) {
                onLoadingChange?.(false);
                return;
            }

            const lat = userLocation?.lat || PARIS_FALLBACK.lat;
            const long = userLocation?.long || PARIS_FALLBACK.long;
            const currentParams = `${intentData.category}-${JSON.stringify(intentData.keywords)}-${lat.toFixed(3)}-${long.toFixed(3)}`;

            const safetyUnlock = setTimeout(() => {
                if (isEffectAlive) {
                    onLoadingChange?.(false);
                }
            }, 7000);

            if (lastExecutionRef.current === currentParams && stores.length > 0) {
                clearTimeout(safetyUnlock);
                onLoadingChange?.(false);
                return;
            }

            activeRequestsRef.current += 1;
            onLoadingChange?.(true);

            console.log("[MapWrapper] Fetching merchants...", { lat, long, category: intentData.category, keywords: intentData.keywords });

            try {
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

                console.log("[MapWrapper] RPC Response:", { data, error });

                if (!isEffectAlive || !isComponentMounted.current) return;

                if (error) {
                    console.error(`[C2 Search][${requestId}] RPC Error:`, error.message);
                } else if (data) {
                    console.log("[MapWrapper] Setting stores:", data.length);
                    setStores(data as Store[]);
                    lastExecutionRef.current = currentParams;
                }
            } catch (e: any) {
                console.error(`[C2 Search][${requestId}] EXCEPTION:`, e.message);
            } finally {
                clearTimeout(safetyUnlock);
                activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
                if (activeRequestsRef.current === 0) {
                    onLoadingChange?.(false);
                }
            }
        };

        fetchMerchants();
        return () => { isEffectAlive = false; };
    }, [intentData?.category, JSON.stringify(intentData?.keywords || []), !!userLocation]);

    // 3. Dynamic Zoom & Centering logic
    useEffect(() => {
        if (stores.length === 0 || !userLocation || !mapRef.current) return;

        const currentStoresId = stores.map(s => s.id).join(',');
        if (lastZoomedStoresId === currentStoresId) return;

        const topOptions = stores.slice(0, 4);
        const allPoints = [[userLocation.long, userLocation.lat], ...topOptions.map(s => [s.long, s.lat])];

        const bounds = allPoints.reduce((acc, coord) => {
            return [[Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])], [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]];
        }, [[allPoints[0][0], allPoints[0][1]], [allPoints[0][0], allPoints[0][1]]]);

        const buffer = 0.003;
        const expandedBounds = [[bounds[0][0] - buffer, bounds[0][1] - buffer], [bounds[1][0] + buffer, bounds[1][1] + buffer]];

        mapRef.current.fitBounds(expandedBounds, {
            padding: { top: 60, bottom: 60, left: 80, right: 80 },
            duration: 1500,
            essential: true
        });

        setLastZoomedStoresId(currentStoresId);
    }, [stores, !!userLocation, !!mapRef.current]);

    const handleLock = async (storeToLock?: Store) => {
        const targetStore = storeToLock || selectedStore;
        if (!targetStore) return;

        setIsLocking(true);
        onLockingChange?.(true);
        if (storeToLock) {
            setSelectedStore(storeToLock);
            onStoreSelected?.(storeToLock);
        } else if (selectedStore) {
            onStoreSelected?.(selectedStore);
        }

        // Fetch a free slot for this org (Demo Logic)
        let slotId = null;
        const { data: slots } = await supabase
            .from('slots')
            .select('id')
            .eq('organization_id', targetStore.id)
            .eq('status', 'free')
            .limit(1);

        if (slots && slots.length > 0) {
            slotId = slots[0].id;
        }

        const { data, error } = await supabase.rpc('api_v1_create_session', {
            p_location_id: targetStore.location_id, // Corrected: Use Location ID, not Org ID
            p_monetization_model: targetStore.business_type === 'service' ? 'commission' : 'subscription',
            p_arrival_timing_minutes: arrivalTiming,
            p_slot_id: slotId
        });

        if (data?.session_id) {
            const session = { id: data.session_id };
            setActiveSession(session);
            activeSessionRef.current = session;
        } else {
            console.error("Lock error:", error);
            setIsLocking(false);
            onLockingChange?.(false);
        }
    };

    const fetchRoute = async (start: [number, number], end: [number, number]) => {
        if (!MAPBOX_TOKEN) return;
        try {
            const query = await fetch(`https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`);
            const json = await query.json();
            if (json.routes && json.routes[0]) {
                const data = json.routes[0];
                const info = { distance: data.distance, duration: data.duration };
                setRouteData({ type: 'Feature', properties: {}, geometry: data.geometry });
                setRouteInfo(info);
                onRouteInfoUpdate?.(info);

                if (mapRef.current) {
                    const coords = data.geometry.coordinates;
                    const b = coords.reduce((acc: any, coord: any) => [[Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])], [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]], [[coords[0][0], coords[0][1]], [coords[0][0], coords[0][1]]]);
                    mapRef.current.fitBounds(b, { padding: { top: 80, bottom: 300, left: 50, right: 50 }, duration: 2000, essential: true });
                }
            }
        } catch (error) { console.error("Error fetching directions:", error); }
    };

    const handleCancelLock = async () => {
        const session = activeSessionRef.current || activeSession;
        if (session) await supabase.from('sessions').update({ state: 'cancelled' }).eq('id', session.id);
        setActiveSession(null);
        activeSessionRef.current = null;
        setIsLocking(false);
        onLockingChange?.(false);
        setIsRevealed(false);
        setSelectedStore(null);
        onStoreSelected?.(null);
    };

    const handleLockExpired = async () => {
        const session = activeSessionRef.current || activeSession;

        // Optimistic UI updates
        setIsRevealed(true);
        onGuidanceStateChange?.(true);
        setIsLocking(false);
        onLockingChange?.(false);

        if (userLocation && selectedStore) {
            fetchRoute([userLocation.long, userLocation.lat], [selectedStore.long, selectedStore.lat]);
        }

        if (session) {
            await supabase.from('sessions').update({ state: 'pending' }).eq('id', session.id);
        }
    };

    const handleArrival = async () => {
        const session = activeSessionRef.current || activeSession;
        if (session) await supabase.from('sessions').update({ state: 'completed' }).eq('id', session.id);
        setIsRevealed(false);
        setActiveSession(null);
        activeSessionRef.current = null;
        setSelectedStore(null);
        setRouteData(null);
        setRouteInfo(null);
        onRouteInfoUpdate?.(null);
        onStoreSelected?.(null);
        onGuidanceStateChange?.(false);
    };

    return (
        <div className={`relative w-full h-full overflow-hidden ${unifiedMode ? '' : 'fixed inset-0'}`}>
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

                {userLocation && (
                    <Marker longitude={userLocation.long} latitude={userLocation.lat} anchor="bottom">
                        <div className="relative flex items-center justify-center h-16 w-16 group">
                            <div className="absolute animate-ping inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></div>
                            <div className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white shadow-lg"></div>
                        </div>
                    </Marker>
                )}

                {stores.slice(0, 4).filter(s => !isRevealed || s.id === selectedStore?.id).map((store, index) => (
                    <Marker key={store.id} latitude={store.lat} longitude={store.long} anchor="bottom" onClick={(e) => { e.originalEvent.stopPropagation(); if (!isLocking && !isRevealed) handleLock(store); }}>
                        {isRevealed ? (
                            <div className="flex flex-col items-center group cursor-pointer transition-transform hover:scale-110">
                                <div className="bg-red-600 p-2 rounded-full shadow-2xl border-2 border-white animate-bounce-subtle">
                                    <MapPin size={24} fill="white" className="text-white" />
                                </div>
                                <div className="w-1.5 h-1.5 bg-red-600 rounded-full -mt-1 shadow-sm border border-white"></div>
                            </div>
                        ) : (
                            <div className={`flex items-center gap-2 p-1.5 rounded-full shadow-xl border-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ${store.business_type === 'service' ? 'bg-white border-purple-600' : 'bg-white border-orange-500'}`}>
                                <div className={`flex items-center justify-center h-8 w-8 rounded-full text-white font-bold text-sm shadow-inner ${store.business_type === 'service' ? 'bg-purple-600' : 'bg-orange-500'}`}>{index + 1}</div>
                                <div className="flex flex-col pr-2 min-w-[60px]">
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800 leading-none">{store.category || store.business_type}</span>
                                    <span className="text-[9px] font-bold text-slate-500">{store.dist_meters ? `${Math.round(store.dist_meters)}m` : 'Proche'}</span>
                                </div>
                            </div>
                        )}
                    </Marker>
                ))}

                {routeData && (
                    <Source id="route" type="geojson" data={routeData}>
                        <Layer id="route-line" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.8 }} />
                    </Source>
                )}
            </Map>
        </div>
    );
});

export default MapWrapper;
