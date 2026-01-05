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
    const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);

    // Payment State (C6)
    const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
    const [paymentTimer, setPaymentTimer] = useState(5);

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

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showPaymentOverlay && paymentTimer > 0) {
            interval = setInterval(() => {
                setPaymentTimer(prev => prev - 1);
            }, 1000);
        } else if (showPaymentOverlay && paymentTimer === 0) {
            // Auto Finalize
            if (activeSession) {
                console.log("Auto-Finalizing Payment...");
                supabase.rpc('api_v1_finalize_payment', { p_session_id: activeSession.id }).then(({ error }) => {
                    if (error) console.error("Finalize Error:", error);
                });
            }
        }
        return () => clearInterval(interval);
    }, [showPaymentOverlay, paymentTimer, activeSession]);
    // Unified "Clean Mode" check
    // If true, we hide everything (Markers, Controls, Parent UI)
    const isCleanMode = showCompletionOverlay || showPaymentOverlay || activeSession?.state === 'in_progress';

    // Sync Overlay State with Parent (Debounced to handle transitions)
    useEffect(() => {
        if (isCleanMode) {
            onOverlayStateChange?.(true);
        } else {
            // Delay sending 'false' to allow for immediate transitions
            const t = setTimeout(() => {
                onOverlayStateChange?.(false);
            }, 100);
            return () => clearTimeout(t);
        }
    }, [isCleanMode, onOverlayStateChange]);

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

    // Session Listener (Cancel/Decline Logic)
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
                        // alert("The Professional has declined the request. They will be temporarily hidden.");

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
                        console.log("[MapWrapper] Service Started (The Gap) - Resetting UI");
                        // RESET UI LOGIC:
                        // Keep activeSession BUT clear the map, route, and store card.
                        setIsRevealed(false);
                        setSelectedStore(null);
                        onStoreSelected?.(null);
                        setRouteData(null);
                        setRouteInfo(null);
                        onRouteInfoUpdate?.(null);
                        onGuidanceStateChange?.(false);

                        // Update local session state to reflect change
                        setActiveSession((prev: any) => ({ ...prev, state: 'in_progress' }));
                        activeSessionRef.current = { ...activeSessionRef.current, state: 'in_progress' };
                    }
                    else if (payload.new.state === 'completed' && payload.old.state !== 'completed') {
                        console.log("[MapWrapper] Session Completed (Transition)!");
                        setShowCompletionOverlay(true);

                        // Auto Dismiss C5 Overlay after 5s
                        // NOTE: We do NOT clear activeSession here. It stays active until Payment Finalization.
                        setTimeout(() => {
                            setShowCompletionOverlay(false);
                        }, 5000);
                    }

                    // Payment Status Updates
                    if (payload.new.payment_status === 'proposed') {
                        setPaymentAmount(payload.new.amount);
                        // Only force close C5 if it's been a while? No, payment implies completion is done.
                        // But if we want to show 'Completed' first, we might have a race condition.
                        // For now, let's prioritize Payment if it arrives.
                        setShowCompletionOverlay(false);
                        setShowPaymentOverlay(true);
                        setPaymentTimer(5);
                    }
                    else if (payload.new.payment_status === 'paid' || payload.new.payment_status === 'failed') {
                        setShowPaymentOverlay(false);
                        setActiveSession(null);
                        activeSessionRef.current = null;
                        setIsLocking(false);
                        onLockingChange?.(false);
                        setSelectedStore(null);
                        onStoreSelected?.(null);
                        setRouteInfo(null);
                        onRouteInfoUpdate?.(null);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeSession?.id]); // Only change if ID changes

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
        // C4 -> P5: Start Service (The Gap)
        const session = activeSessionRef.current || activeSession;
        if (session) {
            console.log("Triggering Arrival -> In Progress");
            await supabase.rpc('api_v1_start_service', { p_session_id: session.id });

            // Note: We don't manually reset UI here anymore, we let the Realtime Listener do it 
            // for consistency (in case Pro triggered it). 
            // BUT to feel instant for the user clicking the button, we can optimistic update:
            setIsRevealed(false);
            setSelectedStore(null);
            onStoreSelected?.(null);
            setRouteData(null);
            setRouteInfo(null);
            onRouteInfoUpdate?.(null);
            onGuidanceStateChange?.(false);
        }
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
                {/* Hide Controls during Payment/Completion/InProgress */}
                {!isCleanMode && (
                    <>
                        <GeolocateControl position="top-left" />
                        <NavigationControl position="top-left" />
                    </>
                )}

                {/* Payment Overlay C6 */}
                {showPaymentOverlay && paymentAmount && (
                    <div className="absolute inset-x-4 top-32 z-[60] animate-in fade-in slide-in-from-top-4">
                        <div className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-2xl rounded-3xl p-6 flex flex-col items-center relative overflow-hidden">

                            {/* Timer Progress Bar (Fill) */}
                            <div
                                className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-1000 ease-linear"
                                style={{ width: `${(paymentTimer / 5) * 100}%` }}
                            />

                            <span className="text-sm font-bold text-green-600 uppercase tracking-widest mb-2">New reward added</span>
                            <div className="text-5xl font-black text-slate-800 mb-4 tracking-tighter">
                                {paymentAmount.toFixed(2)} €
                            </div>

                            <div className="flex justify-between w-full items-center">
                                <p className="text-xs text-slate-400">Pill unfills in {paymentTimer}s...</p>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="rounded-full h-12 w-12 shadow-lg"
                                    onClick={async () => {
                                        if (!activeSession) return;
                                        await supabase.rpc('api_v1_reject_payment', { p_session_id: activeSession.id });
                                        setShowPaymentOverlay(false);
                                    }}
                                >
                                    <span className="font-bold text-xl">X</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {!isCleanMode && userLocation && (
                    <Marker longitude={userLocation.long} latitude={userLocation.lat} anchor="bottom">
                        <div className="relative flex items-center justify-center h-16 w-16 group">
                            <div className="absolute animate-ping inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></div>
                            <div className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white shadow-lg"></div>
                        </div>
                    </Marker>
                )}

                {/* Hide Stores during Payment/Completion */}
                {!isCleanMode && stores.slice(0, 4).filter(s => (!selectedStore) || s.id === selectedStore.id).map((store, index) => (
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

                {routeData && !isCleanMode && (
                    <Source id="route" type="geojson" data={routeData}>
                        <Layer id="route-line" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.8 }} />
                    </Source>
                )}
            </Map>

            {/* Pro Container (Detail Card) - Integrated into Map for clean View State management */}
            {/* HIDDEN during Locking Phase (C3) - Only shows when Revealed (C4) */}
            {!isCleanMode && activeSession && selectedStore && !isLocking && (
                <div className="absolute inset-x-4 bottom-8 z-40 animate-in slide-in-from-bottom duration-500">
                    <Card className="w-full bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-xl">
                        <CardContent className="p-6">
                            <div className="flex flex-col gap-6">
                                <div className="flex items-start justify-between">
                                    <h4 className="text-xl font-black text-slate-900 leading-tight tracking-tight max-w-[70%]">
                                        {selectedStore.name.split(' ')[0]} expects you — <span className="text-blue-600">{routeInfo ? `${Math.ceil(routeInfo.duration / 60)} min` : '5 min'}</span>
                                        <div className="text-sm font-bold text-slate-400 mt-1">{routeInfo ? (routeInfo.distance > 1000 ? `${(routeInfo.distance / 1000).toFixed(1)} km` : `${Math.round(routeInfo.distance)} m`) : '850m'} left</div>
                                    </h4>
                                    <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-slate-50 bg-slate-100 flex-shrink-0 shadow-sm">
                                        <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200" alt="Merchant" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${selectedStore.name}&background=6366f1&color=fff&bold=true`; }} />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-black text-slate-900 truncate tracking-tight">{selectedStore.name}</h3>
                                        <p className="text-sm text-slate-500 font-bold truncate opacity-80">{selectedStore.address}</p>
                                    </div>
                                    <Button
                                        onClick={(e) => { e.stopPropagation(); handleArrival(); }}
                                        className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 flex items-center justify-center p-0 transition-all hover:scale-105 active:scale-95"
                                    >
                                        <Zap size={24} fill="white" className="text-white" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Solid Background for Clean Mode (C5/C6) - Covers the Map */}
            {isCleanMode && (
                <div className="absolute inset-0 bg-slate-50 z-10 animate-in fade-in duration-700" />
            )}

            {/* Service In Progress Overlay (C5 - The Gap) */}
            {activeSession?.state === 'in_progress' && (
                <div className="absolute inset-x-0 bottom-0 top-0 z-50 flex flex-col items-center justify-center animate-in fade-in duration-700">
                    {/* Text centered in the whitespace */}
                    <div className="bg-white/80 backdrop-blur-md px-8 py-4 rounded-full shadow-lg border border-slate-100 flex items-center gap-4">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-lg font-bold text-slate-800 tracking-tight">Haircut in progress</span>
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">By Victor</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Overlay C6 */}
            {showPaymentOverlay && paymentAmount && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-8">
                    <div className="w-full max-w-sm bg-white border border-slate-200 shadow-2xl rounded-[32px] p-8 flex flex-col items-center relative overflow-hidden">

                        {/* Timer Progress Bar (Fill) */}
                        <div
                            className="absolute bottom-0 left-0 h-2 bg-green-500 transition-all duration-1000 ease-linear"
                            style={{ width: `${(paymentTimer / 5) * 100}%` }}
                        />

                        <span className="text-sm font-bold text-green-600 uppercase tracking-widest mb-4">Payment Request</span>
                        <div className="text-6xl font-black text-slate-900 mb-2 tracking-tighter">
                            {paymentAmount.toFixed(2)}€
                        </div>
                        <p className="text-slate-400 text-sm font-medium mb-8">For your hair service</p>

                        <div className="flex flex-col w-full gap-3">
                            <Button
                                className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg"
                                onClick={() => {
                                    // Auto-accept handled by timer, but visuals matter
                                }}
                            >
                                Processing... {paymentTimer}s
                            </Button>

                            <Button
                                variant="ghost"
                                className="w-full h-12 text-slate-400 font-bold hover:text-red-500 hover:bg-red-50 rounded-xl"
                                onClick={async () => {
                                    if (!activeSession) return;
                                    await supabase.rpc('api_v1_reject_payment', { p_session_id: activeSession.id });
                                    setShowPaymentOverlay(false);
                                }}
                            >
                                Reject / Dispute
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Completion Overlay (C6 - formerly C5) */}
            {showCompletionOverlay && (
                <div className="absolute inset-x-0 bottom-0 top-0 bg-slate-50/90 z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="w-full max-w-sm px-6">
                        <div className="w-full bg-slate-200 py-6 text-center rounded-sm mb-2">
                            <h2 className="text-3xl font-black text-slate-700 uppercase tracking-tight">
                                Haircut completed
                            </h2>
                        </div>
                        <div className="w-full text-right mb-12">
                            <p className="text-slate-900 font-medium">Victor</p>
                            <p className="text-slate-600">Today - {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-[32px] rounded-tl-none p-6 text-left shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/40 animate-[ping_1s_ease-out_1]" />
                            <p className="text-xl font-medium text-slate-800 leading-tight relative z-10">
                                This session will be settled via YouCanGo
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default MapWrapper;
