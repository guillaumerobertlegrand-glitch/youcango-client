"use client";

import Map, { Marker, Popup, NavigationControl, GeolocateControl, Source, Layer } from "react-map-gl/mapbox";
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
    onGuidanceStateChange?: (guiding: boolean) => void;
}

const PARIS_FALLBACK = { lat: 48.8566, long: 2.3522 };

export default function MapWrapper({ intentData, onLoadingChange, onGuidanceStateChange }: MapWrapperProps) {
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
    const [routeData, setRouteData] = useState<any>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

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
                    p_keywords: intentData.keywords || [],
                    p_specific_category: (intentData as any).extracted_category || null
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

    const handleLock = async (storeToLock?: Store) => {
        const targetStore = storeToLock || selectedStore;
        if (!targetStore) return;

        setIsLocking(true);
        if (storeToLock) setSelectedStore(storeToLock);

        const monetizationModel = targetStore.business_type === 'service' ? 'commission' : 'subscription';

        // CALL RPC instead of Server Action
        const { data, error } = await supabase.rpc('api_v1_create_session', {
            p_location_id: targetStore.id,
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

    const fetchRoute = async (start: [number, number], end: [number, number]) => {
        if (!MAPBOX_TOKEN) return;
        try {
            const query = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`,
                { method: 'GET' }
            );
            const json = await query.json();
            if (json.routes && json.routes[0]) {
                const data = json.routes[0];
                setRouteData({
                    type: 'Feature',
                    properties: {},
                    geometry: data.geometry
                });
                setRouteInfo({
                    distance: data.distance,
                    duration: data.duration
                });

                // Fit bounds to the actual route
                if (mapRef.current) {
                    const coords = data.geometry.coordinates;
                    const bounds = coords.reduce((acc: any, coord: any) => {
                        return [
                            [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
                            [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
                        ];
                    }, [[coords[0][0], coords[0][1]], [coords[0][0], coords[0][1]]]);

                    mapRef.current.fitBounds(bounds, {
                        padding: { top: 80, bottom: 300, left: 50, right: 50 },
                        duration: 2000,
                        essential: true
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching directions:", error);
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
            onGuidanceStateChange?.(true);

            if (userLocation && selectedStore) {
                fetchRoute([userLocation.long, userLocation.lat], [selectedStore.long, selectedStore.lat]);
            }
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
        setRouteData(null);
        setRouteInfo(null);
        onGuidanceStateChange?.(false);
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

                {/* Store Markers - Hide others when revealed */}
                {stores.slice(0, 4)
                    .filter(s => !isRevealed || s.id === selectedStore?.id)
                    .map((store, index) => (
                        <Marker
                            key={store.id}
                            latitude={store.lat}
                            longitude={store.long}
                            anchor="bottom"
                            onClick={(e) => {
                                e.originalEvent.stopPropagation();
                                if (!isLocking && !isRevealed) {
                                    handleLock(store);
                                }
                            }}
                        >
                            {isRevealed ? (
                                /* PINPOINT UI (Google Maps Style) */
                                <div className="flex flex-col items-center group cursor-pointer transition-transform hover:scale-110">
                                    <div className="bg-red-600 p-2 rounded-full shadow-2xl border-2 border-white animate-bounce-subtle">
                                        <MapPin size={24} fill="white" className="text-white" />
                                    </div>
                                    <div className="mt-1 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-lg shadow-lg border border-slate-200">
                                        <span className="text-[11px] font-black text-slate-800 uppercase leading-none truncate max-w-[120px] block">
                                            {selectedStore?.name}
                                        </span>
                                    </div>
                                    {/* Pin tip/shadow */}
                                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full -mt-1 shadow-sm border border-white"></div>
                                </div>
                            ) : (
                                /* RICH MARKER UI (C2) */
                                <div
                                    className={`flex items-center gap-2 p-1.5 rounded-full shadow-xl border-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ${store.business_type === 'service'
                                        ? 'bg-white border-purple-600'
                                        : 'bg-white border-orange-500'
                                        }`}
                                >
                                    {/* Number Bubble */}
                                    <div className={`flex items-center justify-center h-8 w-8 rounded-full text-white font-bold text-sm shadow-inner ${store.business_type === 'service' ? 'bg-purple-600' : 'bg-orange-500'
                                        }`}>
                                        {index + 1}
                                    </div>

                                    {/* Info Section */}
                                    <div className="flex flex-col pr-2 min-w-[60px]">
                                        <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800 leading-none">
                                            {(store.category || store.business_type)}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-500">
                                            {store.dist_meters ? `${Math.round(store.dist_meters)}m` : 'Proche'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </Marker>
                    ))}

                {/* Route Rendering */}
                {routeData && (
                    <Source id="route" type="geojson" data={routeData}>
                        <Layer
                            id="route-line"
                            type="line"
                            layout={{
                                'line-join': 'round',
                                'line-cap': 'round'
                            }}
                            paint={{
                                'line-color': '#3b82f6',
                                'line-width': 6,
                                'line-opacity': 0.8
                            }}
                        />
                    </Source>
                )}

                {/* Lock Popup (Only DURING locking animation) */}
                {selectedStore && isLocking && !isRevealed && (
                    <Popup
                        longitude={selectedStore.long}
                        latitude={selectedStore.lat}
                        anchor="top"
                        onClose={() => {
                            if (!isLocking) setSelectedStore(null);
                        }}
                        closeButton={false}
                        className="z-50"
                        maxWidth="240px"
                    >
                        <div className="p-4 min-w-[180px] text-center">
                            <div className="py-4">
                                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                                <p className="text-xs font-bold text-blue-600 animate-pulse uppercase tracking-wider">Engagement en cours...</p>
                            </div>
                        </div>
                    </Popup>
                )}
            </Map>

            {/* C3 GUIDANCE UI OVERLAY - Chat Style Bubbles */}
            {isRevealed && selectedStore && (
                <div className="absolute inset-x-0 top-0 pointer-events-none flex flex-col items-center p-4 gap-3 pt-16 z-20">
                    <div className="bg-white/95 backdrop-blur-sm px-5 py-2.5 rounded-2xl rounded-tl-none shadow-lg border border-slate-100 self-start ml-4 max-w-[80%] animate-in fade-in slide-in-from-left duration-500 pointer-events-auto">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{(selectedStore.category || selectedStore.business_type)} - available now</span>
                    </div>
                    <div className="bg-blue-50/95 backdrop-blur-sm px-5 py-2.5 rounded-2xl rounded-tr-none shadow-lg border border-blue-100 self-end mr-4 max-w-[80%] animate-in fade-in slide-in-from-right duration-500 delay-300 pointer-events-auto">
                        <span className="text-xs font-bold text-blue-800">{selectedStore.name.split(' ')[0]} is now waiting for you</span>
                    </div>
                    <div className="bg-green-50/95 backdrop-blur-sm px-5 py-2.5 rounded-2xl rounded-bl-none shadow-lg border border-green-100 self-start ml-4 max-w-[80%] animate-in fade-in slide-in-from-left duration-500 delay-700 pointer-events-auto">
                        <span className="text-xs font-bold text-green-800">YouCanGo!</span>
                    </div>
                </div>
            )}

            {/* C3 BOTTOM DETAILS CARD - Cleaned up */}
            {isRevealed && selectedStore && (
                <div className="absolute inset-x-0 bottom-0 p-4 z-20 animate-in slide-in-from-bottom duration-500">
                    <Card className="w-full bg-white border-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-[32px] overflow-hidden">
                        <CardContent className="p-8">
                            <div className="flex flex-col gap-6">
                                <h4 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                                    {selectedStore.name.split(' ')[0]} is expecting you — <span className="text-blue-600">
                                        {routeInfo ? `${Math.ceil(routeInfo.duration / 60)} min` : '5 min'}
                                    </span>
                                    <div className="text-sm font-bold text-slate-400 mt-1">
                                        {routeInfo ? (routeInfo.distance > 1000 ? `${(routeInfo.distance / 1000).toFixed(1)} km` : `${Math.round(routeInfo.distance)} m`) : '850m'} left
                                    </div>
                                </h4>

                                <div className="flex items-center gap-5">
                                    {/* Avatar */}
                                    <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-slate-50 bg-slate-100 flex-shrink-0 shadow-sm">
                                        <img
                                            src="/Users/grl/.gemini/antigravity/brain/07fab0cb-c98f-4eda-8b66-d2a52d15c6e2/merchant_avatar_demo_1767368669315.png"
                                            alt="Merchant"
                                            className="h-full w-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${selectedStore.name}&background=6366f1&color=fff&bold=true`;
                                            }}
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-black text-slate-900 truncate tracking-tight">{selectedStore.name}</h3>
                                        <p className="text-sm text-slate-500 font-bold truncate opacity-80">{selectedStore.address}</p>
                                        <p className="text-sm text-blue-500 font-bold mt-0.5 tracking-wide">+33 6 08 07 99 71</p>
                                    </div>

                                    <Button
                                        onClick={handleArrival}
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

            {isLocking && (
                <LockTimer
                    duration={10}
                    onCancel={handleCancelLock}
                    onExpire={handleLockExpired}
                />
            )}
        </div>
    );
}
