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
        intent_summary?: string;
        intent_mode?: 'immediacy' | 'delayed'; // Added
        scheduled_at?: string | null;          // Added
    } | null;
    onLoadingChange?: (loading: boolean) => void;
    onGuidanceStateChange?: (guiding: boolean) => void;
    onLockingChange?: (locking: boolean) => void;
    onLockProgress?: (progress: number) => void;
    onStoreSelected?: (store: Store | null) => void;
    onRouteInfoUpdate?: (info: { distance: number; duration: number } | null) => void;
    onSimulationProgress?: (progress: number) => void;
    onOverlayStateChange?: (isVisible: boolean) => void;
    onSessionUpdate?: (session: any) => void;
    unifiedMode?: boolean;
}

const DEMO_CONFIG = {
    'immediacy_service': { lat: 48.8566, long: 2.3522 }, // Paris Center
    'delayed_client': { lat: 45.7772, long: 3.0870 },    // Clermont-Ferrand
    'delayed_rennes': { lat: 48.1173, long: -1.6778 },   // Rennes (Merchant Demo)
    'pro_service': { lat: 48.8566, long: 2.3522 },       // Same as Client
    'pro_merchant': { lat: 48.8566, long: 2.3522 },      // Same as Client
    'parallel': { lat: 48.8566, long: 2.3522 }           // Same as Client
};

const PARIS_FALLBACK = { lat: 48.8566, long: 2.3522 };

const MapWrapper = forwardRef<any, MapWrapperProps>(({
    intentData,
    onLoadingChange,
    onGuidanceStateChange,
    onLockingChange,
    onLockProgress,
    onStoreSelected,
    onRouteInfoUpdate,
    onSimulationProgress,
    onOverlayStateChange,
    onSessionUpdate,
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

    // 1. Stable Geolocation & Demo Presets
    useEffect(() => {
        console.log("[MapWrapper] Initializing Location Logic");

        // CHECK DEMO MODE (Delayed -> Clermont-Ferrand OR Rennes)
        if (intentData?.intent_mode === 'delayed' && intentData?.scheduled_at) {

            // Check for Rennes in keywords
            const isRennes = intentData.keywords?.some(k => k.toLowerCase().includes('rennes')) ||
                intentData.intent_summary?.toLowerCase().includes('rennes');

            if (isRennes || intentData.category === 'florist' || intentData.extracted_category === 'florist') {
                console.log("[MapWrapper] Demo Mode: Delayed (Rennes)");
                setUserLocation(DEMO_CONFIG.delayed_rennes);
                setViewState(prev => ({ ...prev, latitude: DEMO_CONFIG.delayed_rennes.lat, longitude: DEMO_CONFIG.delayed_rennes.long, zoom: 13 }));
            } else {
                console.log("[MapWrapper] Demo Mode: Delayed (Clermont-Ferrand)");
                setUserLocation(DEMO_CONFIG.delayed_client);
                setViewState(prev => ({ ...prev, latitude: DEMO_CONFIG.delayed_client.lat, longitude: DEMO_CONFIG.delayed_client.long, zoom: 13 }));
            }

        } else {
            // Default Demo Location (Paris)
            console.log("[MapWrapper] Demo Mode: Immediacy (Paris)");
            setUserLocation(PARIS_FALLBACK);
        }
    }, [intentData?.intent_mode, intentData?.scheduled_at, intentData?.keywords, intentData?.intent_summary]);

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
                // Combine keywords, category, AND extracted_category for broader search
                const searchKeywords = [...(intentData.keywords || [])];

                // Add the high-level type (e.g. 'service') if not present
                if (intentData.category && !searchKeywords.includes(intentData.category)) {
                    searchKeywords.push(intentData.category);
                }

                // CRITICAL: Add the specific extracted type (e.g. 'restaurant') 
                // This ensures "Table for 2" (kw='table') matches DB Category 'restaurant'
                if (intentData.extracted_category && !searchKeywords.includes(intentData.extracted_category)) {
                    searchKeywords.push(intentData.extracted_category);
                }

                // Correct Category -> Business Type Mapping (Client-side Override)
                // "Table for 2" (AI says 'service') -> DB needs 'merchant' for Restaurant
                const getBusinessType = (cat: string | undefined, extracted: string | undefined): string | null => {
                    const lowerExtracted = (extracted || '').toLowerCase();
                    const lowerCat = (cat || '').toLowerCase();

                    // Explicit Mappings (Align with DB)
                    if (['restaurant', 'bakery', 'grocery', 'florist', 'bookstore', 'mechanic', 'electronics'].some(k => lowerExtracted.includes(k) || lowerCat.includes(k))) {
                        return 'merchant';
                    }
                    if (['hairdresser', 'barber', 'beauty_salon', 'doctor', 'plumber', 'taxi'].some(k => lowerExtracted.includes(k) || lowerCat.includes(k))) {
                        return 'service';
                    }
                    return cat || null; // Fallback to what AI said
                };

                const refinedBusinessType = getBusinessType(intentData.category, intentData.extracted_category);

                const rpcPromise = supabase.rpc('api_v1_get_merchants', {
                    p_lat: lat,
                    p_long: long,
                    p_category: refinedBusinessType, // Use refined type
                    p_keywords: searchKeywords,
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
    }, [intentData?.category, JSON.stringify(intentData?.keywords || []), userLocation?.lat, userLocation?.long]);

    // 2.5 Proximity Watcher for Scheduled/Delayed Sessions
    useEffect(() => {
        if (!activeSession || activeSession.state !== 'scheduled' || stores.length === 0) return;

        const PROXIMITY_THRESHOLD = 800; // meters (Geofence radius)

        const nearbyStore = stores.find(s => s.dist_meters < PROXIMITY_THRESHOLD);

        if (nearbyStore) {
            console.log("[MapWrapper] Proximity Trigger! User is", nearbyStore.dist_meters, "m from", nearbyStore.name);

            // Debounce or ensure we don't spam updates
            // (Strictly speaking this might fire multiple times, but Supabase handles idempotent updates well enough for demo)
            // Ideally check if we are ALREADY locking to avoid spam.

            // Transition to LOCKING
            // 1. Trigger UI Locking State IMMEDIATELY
            setSelectedStore(nearbyStore);
            onStoreSelected?.(nearbyStore);
            setIsLocking(true);
            onLockingChange?.(true);
            onLockProgress?.(100);

            // 2. Optimistic Session Update
            const updatedSession = { ...activeSession, state: 'locking' };
            setActiveSession(updatedSession);
            activeSessionRef.current = updatedSession;

            // 3. Persist to DB
            supabase.from('sessions')
                .update({ state: 'locking' })
                .eq('id', activeSession.id)
                .then(({ error }) => {
                    if (!error) console.log("[MapWrapper] Session transitioned to LOCKING via Proximity.");
                });
        }
    }, [stores, activeSession]); // Re-run when location updates (stores update dist) or session state changes

    // 3. Dynamic Zoom & Centering logic
    useEffect(() => {
        // STOP auto-zoom if we are locked or guiding (simulation handles view)
        if (isLocking || isRevealed) return;

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

                    // HANDLE SCHEDULED AUTO-LOCK (TIME or PROXIMITY)
                    if (payload.new.state === 'scheduled') {
                        // 1. TIME: Check if it's time to transition
                        const scheduledTime = new Date(payload.new.scheduled_at).getTime();
                        const now = Date.now();
                        const timeToLock = scheduledTime - now;

                        if (timeToLock > 0 && timeToLock < 600000) { // If within 10 minutes
                            console.log("[MapWrapper] Auto-Lock Scheduled (Time) in:", timeToLock, "ms");
                            setTimeout(async () => {
                                if (activeSessionRef.current) {
                                    await supabase.from('sessions').update({ state: 'locking' }).eq('id', activeSessionRef.current.id);
                                }
                            }, timeToLock);
                        }
                    }

                    // 2. PROXIMITY CHECK (Reactive)
                    // This is handled in the `stores` useEffect, but we can also check here if we have live store data.
                    // However, `stores` state might be stale in this callback closure.
                    // Ideally, we rely on the `useEffect` watching `stores` & `activeSession` below.

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
                        onSessionUpdate?.(null); // Notify parent
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
        setSelectedStore(targetStore);
        onStoreSelected?.(targetStore); // FIX: Notify parent (ClientHome) for Reveal Card
        onLockingChange?.(true);
        onLockProgress?.(100);

        // Zoom to the selected store pair (User + Store)
        if (mapRef.current && userLocation) {
            const bounds = [
                [Math.min(userLocation.long, targetStore.long), Math.min(userLocation.lat, targetStore.lat)],
                [Math.max(userLocation.long, targetStore.long), Math.max(userLocation.lat, targetStore.lat)]
            ];
            const buffer = 0.0003; // Ultra tight buffer (~30m)
            const expandedBounds = [
                [bounds[0][0] - buffer, bounds[0][1] - buffer],
                [bounds[1][0] + buffer, bounds[1][1] + buffer]
            ] as [mapboxgl.LngLatLike, mapboxgl.LngLatLike];

            console.log("Zooming to bounds:", expandedBounds);

            // Use flyTo for smoother transition if close, or fitBounds if far? 
            // Stick to fitBounds for consistency.
            // Delay slightly to let React render the UI changes (Reveal Card etc)
            // and strictly avoid race conditions with viewState updates
            setTimeout(() => {
                mapRef.current?.fitBounds(expandedBounds, {
                    padding: { top: 50, bottom: 220, left: 20, right: 20 },
                    duration: 1500,
                    essential: true
                });
            }, 200);
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

        // Helper to map technical Categories to nice Intent Labels
        const getServiceName = (category: string | undefined, businessType: 'service' | 'merchant') => {
            const raw = (category || businessType).toLowerCase();

            const MAPPINGS: Record<string, string> = {
                // Beauty / Hair
                'hairdresser': 'Haircut',
                'barber': 'Haircut',
                'beauty_salon': 'Beauty Care',
                'massage': 'Massage',

                // Food / Restaurant
                'restaurant': 'Table for 2',
                'bakery': 'Bakery Order',
                'cafe': 'Coffee',
                'bar': 'Drinks',

                // Auto / Repair
                'mechanic': 'Oil Change',
                'garage': 'Car Repair',
                'electronics': 'Device Repair',

                // Generic Fallbacks
                'merchant': 'Purchase',
                'service': 'Service'
            };

            // Try exact match
            if (MAPPINGS[raw]) return MAPPINGS[raw];

            // Try partial match
            if (raw.includes('hair') || raw.includes('coiff')) return 'Haircut';
            if (raw.includes('food') || raw.includes('restau')) return 'Table for 2';
            if (raw.includes('car') || raw.includes('auto')) return 'Oil Change';

            // Formatting fallback (Capitalize)
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        };

        // PRIORITIZE Intent Summary (User's words) if available
        let serviceRequested = intentData?.intent_summary;

        // If not, try to construct one from Category or Mappings
        if (!serviceRequested) {
            serviceRequested = getServiceName(intentData?.category || targetStore.category, targetStore.business_type);
        } else {
            // Polish the summary (Capitalize first letter)
            serviceRequested = serviceRequested.charAt(0).toUpperCase() + serviceRequested.slice(1);
        }

        // --- NEW: Calculate Real ETA (Truth on Ground) ---
        let estimatedDuration = 15; // default fallback
        if (MAPBOX_TOKEN && userLocation && targetStore) {
            try {
                const start = [userLocation.long, userLocation.lat];
                const end = [targetStore.long, targetStore.lat];
                console.log("[MapWrapper] Calculating Real ETA before session creation...");

                // Fetch Mapbox Directions directly
                const query = await fetch(`https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`);
                const json = await query.json();

                if (json.routes && json.routes[0]) {
                    const durationSec = json.routes[0].duration;
                    estimatedDuration = Math.ceil(durationSec / 60); // Convert to minutes
                    console.log("[MapWrapper] Calculated ETA:", estimatedDuration, "min");
                }
            } catch (err) {
                console.error("Error calculating ETA:", err);
            }
        }

        // --- POLICY ENFORCEMENT: Services are ALWAYS Immediacy ---
        let finalIntentMode = intentData?.intent_mode || 'immediacy';
        let finalScheduledAt = intentData?.scheduled_at || null;

        if (targetStore.business_type === 'service' && finalIntentMode === 'delayed') {
            console.warn("[MapWrapper] Policy Enforcement: Forcing 'immediacy' for Service request.");
            finalIntentMode = 'immediacy';
            finalScheduledAt = null; // Clear scheduled time
        }

        const { data, error } = await supabase.rpc('api_v1_create_session', {
            p_location_id: targetStore.location_id,
            p_monetization_model: targetStore.business_type === 'service' ? 'commission' : 'subscription',
            p_arrival_timing_minutes: arrivalTiming,
            p_slot_id: slotId,
            p_service_requested: serviceRequested, // Dynamic Service Name
            p_estimated_arrival_duration: estimatedDuration, // <--- REAL MAPBOX DATA
            p_scheduled_at: finalScheduledAt, // Enforced Policy
            p_intent_mode: finalIntentMode // Enforced Policy
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
        onSessionUpdate?.(newSession); // Notify parent
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
                    // User requested to KEEP the zoom from Locking phase.
                    // const coords = data.geometry.coordinates;
                    // const b = coords.reduce((acc: any, coord: any) => [[Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])], [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]], [[coords[0][0], coords[0][1]], [coords[0][0], coords[0][1]]]);
                    // mapRef.current.fitBounds(b, { padding: { top: 80, bottom: 300, left: 50, right: 50 }, duration: 2000, essential: true });
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
            console.log("[MapWrapper] Updating Session to PENDING:", session.id);
            const { error } = await supabase.from('sessions').update({ state: 'pending' }).eq('id', session.id);
            if (error) {
                console.error("Critical: Failed to update session:", error);
            } else {
                console.log("[MapWrapper] Session updated to PENDING successfully.");
            }
        } else {
            console.error("Critical: No Active Session found in Ref during Lock Expiration");
        }
    };

    const handleArrival = async () => {
        if (!activeSession) return;

        console.log("Handle Arrival - Triggering Service Start...");
        router.push(`/client/service?session_id=${activeSession.id}`);
        await supabase.rpc('api_v1_start_service', { p_session_id: activeSession.id });
    };

    // Simulation Logic (Option #1: Path Interpolation)
    useEffect(() => {
        console.log("[MapWrapper] Checking Simulation Pre-conditions:", { isRevealed, hasRoute: !!routeData, hasUser: !!userLocation });
        if (!isRevealed || !routeData || !userLocation) return;

        console.log("[MapWrapper] Starting Simulation on Route Path...");
        const coords = routeData.geometry.coordinates; // [[long, lat], ...]
        let currentIndex = 0;

        // Find closest point on path to start (simple approximation: start at 0)
        // Ideally we project current userLocation to path, but for demo, starting at 0 is fine if user is at start.

        const speedFactor = 5; // Skip points to speed up (adjust based on path density)
        // Target 30 seconds to cover the path (matching Pro P3+P4 duration)
        const TARGET_DURATION_MS = 30000;
        const tickInterval = Math.max(50, TARGET_DURATION_MS / coords.length);

        const simulationInterval = setInterval(() => {
            if (currentIndex >= coords.length) {
                clearInterval(simulationInterval);
                console.log("[MapWrapper] Simulation Arrived at destination - Triggering Arrival");
                handleArrival();
                return;
            }

            const nextPoint = coords[currentIndex];
            console.log("Simulating step:", currentIndex, nextPoint);

            setUserLocation({ long: nextPoint[0], lat: nextPoint[1] });
            setViewState(prev => ({ ...prev, longitude: nextPoint[0], latitude: nextPoint[1] })); // Follow user

            const progress = (currentIndex / coords.length) * 100;
            onSimulationProgress?.(progress);

            // Update Estimated Time (decreasing) - SCALED TO REAL WORLD TIME
            // If we started with say 15 mins (routeInfo.duration), and we are at 50%, we should show 7.5 mins.
            // Not the simulation time left.
            if (activeSessionRef.current?.estimated_arrival_duration) {
                // Use the INITIAL DB value as the anchor if possible, or fallback.
                // Ideally we should snap valid start duration.
            }

            // Allow getting initialDuration from the closure or ref.
            // Fallback to routeInfo.duration (seconds)
            const initialDurationSec = routeInfo?.duration || (15 * 60);
            const remainingRealSec = initialDurationSec * (1 - (currentIndex / coords.length));
            const remainingMinutes = Math.ceil(remainingRealSec / 60);

            // Only update if changed
            if (routeInfo && remainingMinutes !== Math.ceil(routeInfo.duration / 60)) {
                onRouteInfoUpdate?.({ ...routeInfo, duration: remainingRealSec });
            }

            // --- SYNC TO DB FOR PRO VIEW (Throttled) ---
            if (activeSessionRef.current && currentIndex % 5 === 0) { // Every 5 ticks
                // console.log("[MapWrapper] Syncing ETA to DB:", remainingMinutes, "min");
                supabase.from('sessions')
                    .update({ estimated_arrival_duration: remainingMinutes })
                    .eq('id', activeSessionRef.current.id)
                    .then(({ error }) => {
                        if (error) console.error("Error syncing ETA:", error);
                    });
            }

            currentIndex += 1;
        }, tickInterval);

        return () => clearInterval(simulationInterval);
    }, [isRevealed, !!routeData]);

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

                {/* Custom Native Markers */}
                {stores.slice(0, 4).filter(s => (!selectedStore) || s.id === selectedStore.id).map((store, index) => (
                    <Marker
                        key={store.id}
                        latitude={store.lat}
                        longitude={store.long}
                        anchor="bottom"
                        onClick={(e) => {
                            e.originalEvent.stopPropagation();
                            if (!isLocking && !isRevealed) handleLock(store);
                        }}
                    >
                        {isRevealed || isLocking ? (
                            <div className="flex flex-col items-center group cursor-pointer">
                                {/* Destination Pin (Red/Active) - Thinner Google Style */}
                                <div className="relative">
                                    <div className="absolute -inset-1 bg-red-500/20 rounded-full blur-sm animate-pulse"></div>
                                    <div className="relative z-10 transform transition-transform hover:scale-110 drop-shadow-md">
                                        <svg width="34" height="42" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 0C5.37258 0 0 5.37258 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37258 18.6274 0 12 0Z" fill="#EA4335" />
                                            <circle cx="12" cy="12" r="5" fill="#781812" fillOpacity="0.2" />
                                            <circle cx="12" cy="12" r="4" fill="white" />
                                        </svg>
                                    </div>
                                </div>
                                {/* Shadow Anchor */}
                                <div className="w-1.5 h-1 bg-black/20 rounded-[100%] blur-[1px] mt-[-2px]"></div>
                            </div>
                        ) : (
                            <div className={`
                                flex items-center gap-2 px-2.5 py-1.5 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-white/60 backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95 group
                                ${store.business_type === 'service' ? 'bg-white/90' : 'bg-white/90'}
                            `}>
                                <div className={`
                                    flex items-center justify-center h-7 w-7 rounded-lg text-white font-semibold text-[13px] shadow-sm
                                    ${store.business_type === 'service' ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-orange-400 to-orange-500'}
                                `}>
                                    {index + 1}
                                </div>
                                <div className="flex flex-col pr-1 min-w-[60px]">
                                    <span className="text-[13px] font-semibold tracking-tight text-slate-800 leading-none mb-0.5 group-hover:text-blue-600 transition-colors capitalize">
                                        {/* Anonymized Name until Revealed */}
                                        {isRevealed ? store.name : (store.category || store.business_type).replace('_', ' ')}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                                        {/* Subtitle: C2 = Distance only. C3 = Category + Distance */}
                                        {isRevealed ? `${store.category || store.business_type} • ` : ''}{store.dist_meters ? `${Math.round(store.dist_meters)}m` : 'Proche'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </Marker>
                ))}

                {routeData && (
                    <Source id="route" type="geojson" data={routeData}>
                        <Layer
                            id="route-border"
                            type="line"
                            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                            paint={{ 'line-color': '#fff', 'line-width': 8, 'line-opacity': 0.8 }}
                        />
                        <Layer
                            id="route-line"
                            type="line"
                            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                            paint={{ 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 1 }}
                        />
                    </Source>
                )}
            </Map>

            {/* Note: All Overlays (Service, Payment, Completion) have been moved to separate pages:
                - /client/service
                - /client/payment
                - /client/completion
            */}
        </div>
    );
});

export default MapWrapper;
