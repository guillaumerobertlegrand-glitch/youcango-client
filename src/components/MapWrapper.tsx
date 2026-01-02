"use client";

import Map, { Marker, Popup, NavigationControl, GeolocateControl } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
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
    const [selectedStore, setSelectedStore] = useState<Store | null>(null);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [isLocking, setIsLocking] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; long: number }>(PARIS_FALLBACK);
    const [arrivalTiming, setArrivalTiming] = useState(15);

    const isComponentMounted = useRef(true);
    const lastExecutionRef = useRef<string>("");
    const activeRequestsRef = useRef(0);

    useEffect(() => {
        isComponentMounted.current = true;
        return () => { isComponentMounted.current = false; };
    }, []);

    // 1. Robust Geolocation
    useEffect(() => {
        if (!navigator.geolocation) return;

        const handleSuccess = (pos: GeolocationPosition) => {
            if (!isComponentMounted.current) return;
            setUserLocation({ lat: pos.coords.latitude, long: pos.coords.longitude });
        };

        const handleError = (err: GeolocationPositionError) => {
            if (!isComponentMounted.current) return;
            console.warn("[Geolocation] Fallback usage:", err.message);
        };

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, { timeout: 3000 });
        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 120000
        });

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // 2. Fetch Effect
    useEffect(() => {
        let isEffectAlive = true;

        const fetchMerchants = async () => {
            if (!intentData?.category) {
                onLoadingChange?.(false);
                return;
            }

            const lat = userLocation.lat;
            const long = userLocation.long;
            const currentParams = `${intentData.category}-${JSON.stringify(intentData.keywords)}-${lat.toFixed(3)}-${long.toFixed(3)}`;

            if (lastExecutionRef.current === currentParams && stores.length > 0) {
                onLoadingChange?.(false);
                return;
            }

            onLoadingChange?.(true);
            activeRequestsRef.current += 1;

            try {
                const { data, error } = await supabase.rpc('api_v1_get_merchants', {
                    p_lat: lat,
                    p_long: long,
                    p_category: intentData.category,
                    p_keywords: intentData.keywords || []
                });

                if (isEffectAlive && data) {
                    setStores(data as Store[]);
                    lastExecutionRef.current = currentParams;
                }
            } catch (e) {
                console.error("Fetch error:", e);
            } finally {
                activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
                if (activeRequestsRef.current === 0) onLoadingChange?.(false);
            }
        };

        fetchMerchants();
        return () => { isEffectAlive = false; };
    }, [intentData?.category, JSON.stringify(intentData?.keywords || []), userLocation.lat, userLocation.long]);

    const handleLock = async () => {
        if (!selectedStore) return;
        setIsLocking(true);
        const monetizationModel = selectedStore.business_type === 'service' ? 'commission' : 'subscription';
        const { data, error } = await supabase.rpc('api_v1_create_session', {
            p_location_id: selectedStore.id,
            p_monetization_model: monetizationModel,
            p_arrival_timing_minutes: arrivalTiming
        });
        if (data?.session_id) {
            setActiveSession({ id: data.session_id });
        } else {
            setIsLocking(false);
        }
    };

    const handleCancelLock = async () => {
        if (activeSession) await supabase.from('sessions').update({ state: 'cancelled' }).eq('id', activeSession.id);
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
        if (activeSession) await supabase.from('sessions').update({ state: 'completed' }).eq('id', activeSession.id);
        setIsRevealed(false);
        setActiveSession(null);
        setSelectedStore(null);
    };

    return (
        <div className="w-full h-full relative">
            <Map
                {...viewState}
                onMove={(evt) => setViewState(evt.viewState)}
                style={{ width: "100%", height: "calc(100vh - 64px)" }}
                mapStyle="mapbox://styles/mapbox/light-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
                mapLib={mapboxgl}
                onLoad={() => console.log("[MAP_LOAD_SUCCESS] Mapbox is ready!")}
                onError={(e) => console.error("[Mapbox Error]", e.error)}
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

                {stores.map((store) => (
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
                        <div className="cursor-pointer transition-transform hover:scale-110">
                            {store.business_type === 'service' ? (
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-600 text-white shadow-lg border-2 border-white">
                                    <Zap size={16} fill="currentColor" />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-orange-500 text-white shadow-lg border-2 border-white">
                                    <StoreIcon size={16} />
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
                                        <h3 className="font-bold text-sm text-slate-900">{selectedStore.name}</h3>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                            {selectedStore.dist_meters ? `${Math.round(selectedStore.dist_meters)}m • ` : ''}
                                            {selectedStore.business_type}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                            <Clock size={12} />
                                            Timing d'arrivée
                                        </div>
                                        <div className="grid grid-cols-3 gap-1">
                                            {[15, 30, 45].map((t) => (
                                                <button
                                                    key={t}
                                                    onClick={() => setArrivalTiming(t)}
                                                    className={`py-1 text-xs rounded-md transition-all font-bold ${arrivalTiming === t ? 'bg-black text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                                                >
                                                    {t}m
                                                </button>
                                            ))}
                                        </div>
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
