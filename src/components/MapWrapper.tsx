"use client";

import Map, { Marker, Popup, NavigationControl, GeolocateControl, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRouter } from 'next/navigation';
import { getOrCreateAnonymousId } from "@/utils/auth-helpers";
import mapboxgl from 'mapbox-gl';
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
    onOverlayStateChange?: (isVisible: boolean) => void;
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
    onOverlayStateChange,
    unifiedMode
}, ref) => {
    const supabase = createClient();
    const router = useRouter();
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
        return () => clearInterval(timer);
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
                const viewerId = getOrCreateAnonymousId();
                const rpcPromise = supabase.rpc('api_v1_get_merchants', {
                    p_lat: lat,
                    p_long: long,
                    p_category: intentData.category,
                    p_keywords: intentData.keywords || [],
                    p_radius_meters: 5000,
                    p_viewer_id: viewerId // Pass identity for Cooldown filtering
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
                    // Filter out excluded merchants (Temporary Decline)
                    const visibleStores = (data as Store[]).filter(s => !excludedMerchantIds.includes(s.id));
                    setStores(visibleStores);
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

    const [excludedMerchantIds, setExcludedMerchantIds] = useState<string[]>([]);

    // Session Listener (Cancel/Decline Logic + Start Service Redirect)
    useEffect(() => {
        const sessionId = activeSession?.id;
        if (!sessionId) return;

        console.log("[MapWrapper] Listening for updates on session:", sessionId);
        const channel = supabase
            .channel(`session-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `id=eq.${sessionId}`
                },
                (payload) => {
                    console.log("[MapWrapper] Session Update:", payload);
                    if (payload.new.state === 'cancelled') {
                        // 1. Exclude the merchant
                        if (selectedStore) {
                            const blockedId = selectedStore.id;
                            setExcludedMerchantIds(prev => [...prev, blockedId]);
                            // Force immediate update of displayed stores
                            setStores(prevStores => prevStores.filter(s => s.id !== blockedId));
                        }

                        // 2. Reset State
                        setActiveSession(null);
                        activeSessionRef.current = null;
                        setIsLocking(false);
                        onLockingChange?.(false);
                        setSelectedStore(null);
                        onStoreSelected?.(null);
                        setRouteInfo(null);
                        onRouteInfoUpdate?.(null);
                    }
                    else if (payload.new.state === 'in_progress') {
                        console.log("[MapWrapper] Service Started - Redirecting to /client/service");
                        router.push(`/client/service?session_id=${sessionId}`);
                    }
                    else if (payload.new.state === 'completed') {
                        console.log("[MapWrapper] Session Completed - Redirecting to /client/payment");
                        router.push(`/client/payment?session_id=${sessionId}`);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeSession?.id, router]);

    const handleLock = async (storeToLock?: Store) => {
        const targetStore = storeToLock || selectedStore;
        if (!targetStore) return;

        if (targetStore.id === 'debug-store') return;

        console.log("LOCKING on store:", targetStore);
        setIsLocking(true);
        setSelectedStore(targetStore); // FIX: Ensure selectedStore is set for filtering
        onLockingChange?.(true);
        onLockProgress?.(100);

        // Zoom to the selected store pair (User + Store)
        if (mapRef.current && userLocation) {
            const bounds = [
                [Math.min(userLocation.long, targetStore.long), Math.min(userLocation.lat, targetStore.lat)],
                [Math.max(userLocation.long, targetStore.long), Math.max(userLocation.lat, targetStore.lat)]
            ];
            const buffer = 0.002; // Tighter zoom for locking
            const expandedBounds = [
                [bounds[0][0] - buffer, bounds[0][1] - buffer],
                [bounds[1][0] + buffer, bounds[1][1] + buffer]
            ] as [mapboxgl.LngLatLike, mapboxgl.LngLatLike];

            mapRef.current.fitBounds(expandedBounds, {
                padding: { top: 100, bottom: 300, left: 50, right: 50 },
                duration: 1000,
                essential: true
            });
        }

        // Fetch a free slot for this org (Demo Logic)
        let slotId = null;
        // Try to find a slot if possible, otherwise let backend handle or fail (nullable)
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
            p_location_id: targetStore.location_id,
            p_monetization_model: targetStore.business_type === 'service' ? 'commission' : 'subscription',
            p_arrival_timing_minutes: arrivalTiming,
            p_slot_id: slotId
        });

        if (error) {
            console.error("Session Creation Error:", error);
            alert("Error creating session");
            setIsLocking(false);
            onLockingChange?.(false);
            return;
        }

        // RPC returns { session_id, status }, but we need { id, ... } for consistency
        const newSession = {
            ...data,
            id: data.session_id // Map session_id to id
        };
        console.log("Session Created (Normalized):", newSession);
        setActiveSession(newSession);
        activeSessionRef.current = newSession;

        // Start Countdown (simulated locally for UI, but backed by P2 timer on Pro side)
        // ... handled by useEffect
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
        if (!activeSession) return;

        console.log("Handle Arrival - Triggering Service Start...");
        router.push(`/client/service?session_id=${activeSession.id}`);
        await supabase.rpc('api_v1_start_service', { p_session_id: activeSession.id });
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
                onClick={() => {
                    if (!isLocking && !isRevealed) {
                        setSelectedStore(null);
                        onStoreSelected?.(null);
                    }
                }}
            >
                <GeolocateControl position="top-right" />
                <NavigationControl position="top-right" />

                {/* Debug Marker */}
                {userLocation && (
                    <Marker longitude={userLocation.long} latitude={userLocation.lat} anchor="center">
                        <div className="h-4 w-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                    </Marker>
                )}

                {/* Markers */}
                {stores.slice(0, 4).filter(s => (!selectedStore) || s.id === selectedStore.id).map((store, index) => (
                    <Marker key={store.id} latitude={store.lat} longitude={store.long} anchor="bottom" onClick={(e) => { e.originalEvent.stopPropagation(); if (!isLocking && !isRevealed) handleLock(store); }}>
                        {isRevealed || isLocking ? (
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

            {/* Pro Container (Detail Card) */}
            {activeSession && selectedStore && !isLocking && (
                <div className="absolute inset-x-4 bottom-8 z-40 animate-in slide-in-from-bottom duration-500">
                    <Card className="w-full bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 relative overflow-hidden">
                                        {/* Avatar Placeholder */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300"></div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 leading-tight">{selectedStore.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 font-bold">
                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-xs uppercase tracking-wider">Expert</span>
                                            <span>• 4.9 ★</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-slate-900 tracking-tighter">12 min</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Arrival</div>
                                </div>
                            </div>

                            <Button
                                onClick={handleArrival}
                                className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-lg font-bold shadow-lg shadow-slate-200 transition-all active:scale-95"
                            >
                                I'm here
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Note: All Overlays (Service, Payment, Completion) have been moved to separate pages:
                - /client/service
                - /client/payment
                - /client/completion
            */}
        </div>
    );
});

export default MapWrapper;
