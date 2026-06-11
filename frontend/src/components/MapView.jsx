import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { evAPI, navigationAPI } from "../utils/api.js";
import { useAssistantSocket } from "../utils/useAssistantSocket.js";

// Fix for default Leaflet marker assets in bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM ICONS
// ─────────────────────────────────────────────────────────────────────────────
const createCustomIcon = (color, svgPath, size = 36) =>
  L.divIcon({
    html: `<div style="
        width:${size}px;height:${size}px;background:${color};
        border-radius:50%;border:3px solid white;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px rgba(0,0,0,0.4);">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          fill="white" width="${size * 0.48}px" height="${size * 0.48}px">${svgPath}</svg>
      </div>`,
    className: "custom-leaflet-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });

const PIN_PATH =
  '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>';
const BOLT_PATH =
  '<path d="M16 10h-2V3a1 1 0 0 0-1.66-.77l-8 7a1 1 0 0 0 .66 1.77h3v7a1 1 0 0 0 1.66.77l8-7a1 1 0 0 0-.66-1.77z"/>';
const PERSON_PATH =
  '<circle cx="12" cy="8" r="3.5"/><path d="M12 13c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z"/>';

const startIcon    = createCustomIcon("#10B981", PIN_PATH);
const endIcon      = createCustomIcon("#EF4444", PIN_PATH);
const chargerOn    = createCustomIcon("#059669", BOLT_PATH, 30);
const chargerOff   = createCustomIcon("#D97706", BOLT_PATH, 30);

// Pulsing live-user navigation arrow icon
const createNavIcon = (isNavigating) =>
  L.divIcon({
    html: `<div style="position:relative;width:44px;height:44px;">
      <div style="position:absolute;inset:0;border-radius:50%;
        background:rgba(59,130,246,0.2);
        animation:livePulse 1.8s ease-out infinite;"></div>
      <div style="position:absolute;inset:4px;
        background:${isNavigating ? "#1D4ED8" : "#3B82F6"};
        border-radius:50%;border:3px solid white;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px rgba(59,130,246,0.6);">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16px" height="16px">
          ${isNavigating
            ? '<path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>'
            : `<circle cx="12" cy="8" r="3.5"/><path d="M12 13c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z"/>`}
        </svg>
      </div>
    </div>
    <style>
      @keyframes livePulse{
        0%{transform:scale(1);opacity:0.7}
        70%{transform:scale(2.2);opacity:0}
        100%{transform:scale(2.4);opacity:0}
      }
    </style>`,
    className: "custom-leaflet-icon",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  });

// ─────────────────────────────────────────────────────────────────────────────
// Turn arrow SVG paths by maneuver type/modifier
// ─────────────────────────────────────────────────────────────────────────────
function getTurnIcon(instruction = "", state = "") {
  const lower = (instruction + " " + state).toLowerCase();
  if (lower.includes("arrive"))
    return { path: '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>', color: "#10B981" };
  if (lower.includes("turn_now") || lower.includes("turn now"))
    return { path: '<path d="M14 5l7 7m0 0l-7 7m7-7H3"/>', color: "#EF4444" };
  if (lower.includes("sharp left"))
    return { path: '<path d="M3 12h12M3 12l7-7M3 12l7 7M21 5l-4 7 4 7"/>', color: "#F97316" };
  if (lower.includes("sharp right"))
    return { path: '<path d="M21 12H9M21 12l-7-7M21 12l-7 7M3 5l4 7-4 7"/>', color: "#F97316" };
  if (lower.includes("turn left") || lower.includes("left"))
    return { path: '<path d="M7 16l-4-4m0 0l4-4m-4 4h18"/>', color: "#3B82F6" };
  if (lower.includes("turn right") || lower.includes("right"))
    return { path: '<path d="M17 8l4 4m0 0l-4 4m4-4H3"/>', color: "#3B82F6" };
  if (lower.includes("u-turn") || lower.includes("uturn"))
    return { path: '<path d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>', color: "#8B5CF6" };
  if (lower.includes("rerouting") || lower.includes("recalcul"))
    return { path: '<path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>', color: "#EF4444" };
  // Default: straight ahead
  return { path: '<path d="M5 10l7-7m0 0l7 7m-7-7v18"/>', color: "#6366F1" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Haversine distance utility (client-side for ETA estimate)
// ─────────────────────────────────────────────────────────────────────────────
function haversineM(p1, p2) {
  const R = 6371000;
  const φ1 = (p1[0] * Math.PI) / 180;
  const φ2 = (p2[0] * Math.PI) / 180;
  const Δφ = ((p2[0] - p1[0]) * Math.PI) / 180;
  const Δλ = ((p2[1] - p1[1]) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: Auto-fit map bounds when route loads
// ─────────────────────────────────────────────────────────────────────────────
function MapBoundsController({ bounds }) {
  const map = useMap();
  const prevKey = useRef(null);
  useEffect(() => {
    if (!bounds || bounds.length < 2) return;
    const key = `${bounds[0]}-${bounds[bounds.length - 1]}`;
    if (key === prevKey.current) return;
    prevKey.current = key;
    try {
      map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 16, animate: true });
    } catch { /* ignore */ }
  }, [bounds, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: Pan to live position smoothly
// ─────────────────────────────────────────────────────────────────────────────
function LivePanController({ position, shouldAutoPan }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (!position || !shouldAutoPan) return;
    if (prev.current && haversineM(prev.current, position) < 10) return;
    map.panTo(position, { animate: true, duration: 0.8 });
    prev.current = position;
  }, [position, shouldAutoPan, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Build GeoJSON LineString from [lat,lng][] array
// ─────────────────────────────────────────────────────────────────────────────
function buildGeoJSONLine(geometry) {
  if (!geometry || geometry.length < 2) return null;
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: geometry.map(([lat, lng]) => [lng, lat]),
      },
      properties: {},
    }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Format duration seconds → "12 min" / "1 h 5 min"
// ─────────────────────────────────────────────────────────────────────────────
function fmtDuration(seconds) {
  if (!seconds) return "--";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Format distance meters → "420 m" / "3.2 km"
// ─────────────────────────────────────────────────────────────────────────────
function fmtDist(meters) {
  if (!meters && meters !== 0) return "--";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function MapView({
  livePosition   = null,
  geoError       = null,
  autoPan        = true,
  onToggleAutoPan,
  startCoords,
  endCoords,
  routeGeometry,
  nearbyStations = [],
  travelMode     = "EV",
  onToggleStation,
  onOffRoute,
  theme          = "dark",
}) {
  const userMarkerRef = useRef(null);
  const telemetryLock = useRef(false); // prevent overlapping telemetry calls

  // Get current user ID
  const currentUser = JSON.parse(localStorage.getItem("greenpath_user") || "null");
  const userId = currentUser?.id || "anonymous";

  // ── local state ────────────────────────────────────────────────────────────
  const [currentPosition, setCurrentPosition] = useState(livePosition);
  const [localGeoError,   setLocalGeoError]   = useState(geoError);
  const [stations,        setStations]         = useState(nearbyStations);
  const [localGeometry,   setLocalGeometry]    = useState(routeGeometry);

  // Navigation state machine
  const [isNavigating,      setIsNavigating]      = useState(false);
  const [navState,          setNavState]          = useState("IDLE");
  const [instruction,       setInstruction]       = useState("Enter origin & destination, then tap Compare.");
  const [distToTurn,        setDistToTurn]        = useState(null);
  const [stepIndex,         setStepIndex]         = useState(0);
  const [totalDistM,        setTotalDistM]        = useState(null);
  const [totalDurS,         setTotalDurS]         = useState(null);
  const [navStartTime,      setNavStartTime]      = useState(null);
  const [startError,        setStartError]        = useState("");

  const { emitGpsUpdate, navState: wsNavState } = useAssistantSocket();

  // ── Sync incoming props ────────────────────────────────────────────────────
  useEffect(() => { if (livePosition) setCurrentPosition(livePosition); }, [livePosition]);
  useEffect(() => { if (geoError)     setLocalGeoError(geoError);       }, [geoError]);
  useEffect(() => { setStations(nearbyStations); },                        [nearbyStations]);
  useEffect(() => { setLocalGeometry(routeGeometry); },                    [routeGeometry]);

  // Sync WebSocket nav updates to local states
  useEffect(() => {
    if (isNavigating && wsNavState) {
      if (wsNavState.state)              setNavState(wsNavState.state);
      if (wsNavState.bannerInstruction)  setInstruction(wsNavState.bannerInstruction);
      if (wsNavState.currentStepIndex != null) setStepIndex(wsNavState.currentStepIndex);
      if (wsNavState.distanceToTurn != null)   setDistToTurn(wsNavState.distanceToTurn);
      if (wsNavState.routeGeometry)      setLocalGeometry(wsNavState.routeGeometry);
      if (wsNavState.state === "OFF_ROUTE" && onOffRoute && currentPosition) {
        onOffRoute(currentPosition);
      }
    }
  }, [wsNavState, isNavigating, onOffRoute]);

  // ── 1. Geolocation watcher (high-accuracy) ────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocalGeoError("Geolocation is not supported by this browser.");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        // Smoothly move the persistent marker instead of rebuilding it
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(newPos);
        }
        setCurrentPosition(newPos);
        setLocalGeoError(null);
        if (isNavigating) {
          sendTelemetry(newPos);
        }
      },
      (err) => setLocalGeoError(err.message || "GPS unavailable."),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isNavigating, stepIndex]);

  // ── 2. EV station refresh every 30 s ──────────────────────────────────────
  useEffect(() => {
    if (!startCoords || !endCoords) return;
    const poll = setInterval(async () => {
      try {
        const all = await evAPI.getAll();
        const pad = 0.15;
        const filtered = all.filter((s) => {
          const lat = Number(s.latitude), lng = Number(s.longitude);
          return (
            lat >= Math.min(startCoords[0], endCoords[0]) - pad &&
            lat <= Math.max(startCoords[0], endCoords[0]) + pad &&
            lng >= Math.min(startCoords[1], endCoords[1]) - pad &&
            lng <= Math.max(startCoords[1], endCoords[1]) + pad
          );
        });
        setStations(filtered);
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(poll);
  }, [startCoords, endCoords]);

  // ── 3. Send telemetry to backend state machine ─────────────────────────────
  const sendTelemetry = (coords) => {
    // Emit GPS update via WebSocket
    emitGpsUpdate(coords[0], coords[1], 0, 0, stepIndex);
  };

  // ── 4. Start Navigation ────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!startCoords || !endCoords) {
      setStartError("Compare a route first to enable navigation.");
      return;
    }
    setStartError("");
    try {
      const res = await navigationAPI.startNavigation(startCoords, endCoords, travelMode, userId);
      setNavState(res.state || "ROUTE_ACTIVE");
      setLocalGeometry(res.geometry);
      setTotalDistM(res.distanceM);
      setTotalDurS(res.durationS);
      setStepIndex(0);
      setDistToTurn(null);
      setInstruction("Follow the highlighted route.");
      setIsNavigating(true);
      setNavStartTime(Date.now());
    } catch (err) {
      console.error("Start nav error:", err);
      setStartError("Failed to start navigation. Is the backend running?");
    }
  };

  const handleStop = () => {
    setIsNavigating(false);
    setNavState("IDLE");
    setInstruction("Navigation stopped.");
    setDistToTurn(null);
    setStepIndex(0);
    setNavStartTime(null);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const { path: arrowPath, color: arrowColor } = getTurnIcon(instruction, navState);

  // Remaining time: rough estimate from elapsed
  const elapsedS  = navStartTime ? (Date.now() - navStartTime) / 1000 : 0;
  const remainS   = totalDurS ? Math.max(0, totalDurS - elapsedS) : null;
  const arrivalTime = remainS != null
    ? new Date(Date.now() + remainS * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Route polyline color per transport mode
  const geoJSONStyle = useCallback(() => ({
    color:
      travelMode === "EV"      ? "#3B82F6"  // Electric Blue
    : travelMode === "CYCLING" ? "#10B981"  // Emerald Green
    :                            "#F97316", // Transit: Orange
    weight:    travelMode === "EV" ? 7 : 6,
    opacity:   0.90,
    dashArray: travelMode === "TRANSIT" ? "12, 9" : undefined,
    lineCap:   "round",
    lineJoin:  "round",
  }), [travelMode]);

  // Bounds for auto-fit
  const bounds = [];
  if (startCoords) bounds.push(startCoords);
  if (endCoords)   bounds.push(endCoords);
  if (localGeometry?.length > 4) {
    for (let i = 0; i < localGeometry.length; i += 10) bounds.push(localGeometry[i]);
    bounds.push(localGeometry[localGeometry.length - 1]);
  }

  const geoJSONData  = buildGeoJSONLine(localGeometry);
  const navIcon      = createNavIcon(isNavigating);
  const tileUrl      = theme === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const mapCenter    = currentPosition || startCoords || [16.7050, 74.2433];
  const mapZoom      = currentPosition ? 15 : startCoords ? 13 : 11;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 transition-colors">

      {/* ── REROUTING full-screen flash ── */}
      {navState === "REROUTING" && (
        <div className="absolute inset-0 z-[1200] pointer-events-none">
          <div className="absolute inset-0 bg-orange-500/10 animate-pulse rounded-xl" />
          <div className="absolute inset-0 border-4 border-orange-500/50 rounded-xl animate-pulse" />
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TOP CARD — Google Maps-style instruction card
          ════════════════════════════════════════════════ */}
      {localGeometry ? (
        <div className={`absolute top-3 left-3 right-3 z-[1100] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          navState === "TURN_NOW"        ? "ring-2 ring-red-500/60"
        : navState === "APPROACHING_TURN"? "ring-2 ring-amber-500/50"
        : navState === "REROUTING"       ? "ring-2 ring-orange-500/60"
        : ""
        }`}>

          {/* Coloured accent stripe */}
          <div className="h-1 w-full" style={{ background: arrowColor }} />

          <div className="bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl px-4 py-3">
            <div className="flex items-center gap-3">

              {/* Turn direction icon */}
              <div
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-inner transition-colors"
                style={{ background: arrowColor + "20", border: `2px solid ${arrowColor}30` }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={arrowColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7"
                >
                  <path d={arrowPath} />
                </svg>
              </div>

              {/* Instruction text + distance to turn */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-neutral-900 dark:text-white leading-snug line-clamp-2">
                  {instruction}
                </p>
                {distToTurn != null && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{fmtDist(distToTurn)}</span>
                    &nbsp;to next maneuver
                  </p>
                )}
              </div>

              {/* State pill */}
              <div className="flex-shrink-0">
                <span className={`text-3xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${
                  navState === "FOLLOWING_ROUTE"    ? "bg-emerald-500/10 text-emerald-600 border-emerald-400/30"
                : navState === "ROUTE_ACTIVE"       ? "bg-blue-500/10 text-blue-600 border-blue-400/30"
                : navState === "APPROACHING_TURN"   ? "bg-amber-500/10 text-amber-600 border-amber-400/30"
                : navState === "TURN_NOW"           ? "bg-red-500/10 text-red-600 border-red-400/30 animate-pulse"
                : navState === "REROUTING"          ? "bg-orange-500/10 text-orange-600 border-orange-400/30 animate-pulse"
                :                                     "bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                }`}>
                  {navState === "IDLE" ? "Ready" : navState.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* Start / Stop row */}
            <div className="mt-3 flex gap-2">
              {!isNavigating ? (
                <button
                  onClick={handleStart}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-600/20"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Start Navigation
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex-1 flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white hover:bg-neutral-700 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold py-2.5 rounded-xl text-xs transition-all shadow-md"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                  Stop Navigation
                </button>
              )}
            </div>

            {startError && (
              <p className="mt-2 text-xs text-red-500 font-medium text-center">{startError}</p>
            )}
          </div>
        </div>
      ) : (
        /* No route yet — small GPS badge at top */
        <div className={`absolute top-3 left-3 z-[1100] flex items-center gap-1.5 text-2xs font-semibold
          px-3 py-1.5 rounded-full shadow-md pointer-events-none backdrop-blur-md ${
          currentPosition
            ? "bg-blue-600/90 text-white"
            : "bg-neutral-950/80 text-neutral-400 border border-neutral-800"
        }`}>
          <span className={`w-2 h-2 rounded-full ${currentPosition ? "bg-white animate-pulse" : "bg-neutral-500"}`} />
          {currentPosition
            ? `GPS active • ${currentPosition[0].toFixed(5)}, ${currentPosition[1].toFixed(5)}`
            : localGeoError ? "GPS unavailable" : "Acquiring GPS…"}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          BOTTOM STRIP — Google Maps ETA bar
          ════════════════════════════════════════════════ */}
      {isNavigating && (
        <div className="absolute bottom-0 left-0 right-0 z-[1100] bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-200/50 dark:border-neutral-800/50 shadow-2xl px-5 py-3 flex items-center gap-4">
          {/* ETA */}
          <div className="flex flex-col items-center">
            <span className="text-xl font-black text-neutral-900 dark:text-white leading-none">
              {arrivalTime ?? "--"}
            </span>
            <span className="text-3xs text-neutral-400 font-medium mt-0.5">Arrival</span>
          </div>

          <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800" />

          {/* Time remaining */}
          <div className="flex flex-col items-center">
            <span className="text-lg font-extrabold text-neutral-800 dark:text-neutral-100 leading-none">
              {fmtDuration(remainS)}
            </span>
            <span className="text-3xs text-neutral-400 font-medium mt-0.5">Remaining</span>
          </div>

          <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800" />

          {/* Total distance */}
          <div className="flex flex-col items-center">
            <span className="text-lg font-extrabold text-neutral-800 dark:text-neutral-100 leading-none">
              {fmtDist(totalDistM)}
            </span>
            <span className="text-3xs text-neutral-400 font-medium mt-0.5">Total</span>
          </div>

          <div className="flex-1" />

          {/* Mode badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-2xs font-bold border ${
            travelMode === "EV"      ? "bg-blue-500/10 text-blue-600 border-blue-400/30"
          : travelMode === "CYCLING" ? "bg-emerald-500/10 text-emerald-600 border-emerald-400/30"
          :                            "bg-orange-500/10 text-orange-600 border-orange-400/30"
          }`}>
            <span>{travelMode === "EV" ? "⚡" : travelMode === "CYCLING" ? "🚲" : "🚌"}</span>
            <span>{travelMode}</span>
          </div>
        </div>
      )}

      {/* GPS badge when navigating (bottom-left) */}
      {localGeometry && !isNavigating && (
        <div className={`absolute bottom-3 left-3 z-[1100] flex items-center gap-1.5 text-2xs font-semibold
          px-2.5 py-1.5 rounded-full shadow-md pointer-events-none ${
          currentPosition
            ? "bg-blue-600/90 text-white"
            : "bg-neutral-950/80 text-neutral-400 border border-neutral-800"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${currentPosition ? "bg-white animate-pulse" : "bg-neutral-500"}`} />
          {currentPosition
            ? `GPS • ${currentPosition[0].toFixed(4)}, ${currentPosition[1].toFixed(4)}`
            : localGeoError ? "GPS off" : "Locating…"}
        </div>
      )}

      {/* ── Leaflet Map ──────────────────────────────────────────────────────── */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />

        {bounds.length >= 2 && <MapBoundsController bounds={bounds} />}
        <LivePanController position={currentPosition} shouldAutoPan={autoPan && isNavigating} />

        {/* Live user marker — updated via ref, no re-mount */}
        {currentPosition && (
          <Marker ref={userMarkerRef} position={currentPosition} icon={navIcon} zIndexOffset={1000}>
            <Popup>
              <div className="p-1 font-sans min-w-[160px]">
                <span className="font-bold text-blue-600 block text-sm mb-1">📍 Your Location</span>
                <span className="text-xs text-neutral-500 block">
                  {currentPosition[0].toFixed(6)}, {currentPosition[1].toFixed(6)}
                </span>
                {navState === "OFF_ROUTE" && (
                  <span className="text-xs text-amber-600 block mt-1.5 font-semibold">⚠ Off route — recalculating</span>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Origin */}
        {startCoords && (
          <Marker position={startCoords} icon={startIcon}>
            <Popup>
              <div className="p-1 font-sans">
                <span className="font-bold text-emerald-600 block text-sm">🟢 Origin</span>
                <span className="text-xs text-neutral-500">Trip start point</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination */}
        {endCoords && (
          <Marker position={endCoords} icon={endIcon}>
            <Popup>
              <div className="p-1 font-sans">
                <span className="font-bold text-red-600 block text-sm">🔴 Destination</span>
                <span className="text-xs text-neutral-500">Trip end point</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route polyline — redraws when geometry or mode changes */}
        {geoJSONData && (
          <GeoJSON
            key={`route-${travelMode}-${localGeometry?.length}-${navState}`}
            data={geoJSONData}
            style={geoJSONStyle}
          />
        )}

        {/* EV Charging station markers */}
        {stations.map((station) => {
          const isOn = station.isAvailable;
          const lat  = Number(station.latitude);
          const lng  = Number(station.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          return (
            <Marker key={station.id} position={[lat, lng]} icon={isOn ? chargerOn : chargerOff}>
              <Popup>
                <div className="p-2 min-w-[200px] font-sans">
                  <h4 className="font-bold text-sm border-b border-neutral-200 pb-1.5 mb-2 flex items-center gap-1.5">
                    <span>⚡</span>{station.name}
                  </h4>
                  <div className="space-y-1 mb-3 text-xs">
                    <p className="text-neutral-500">
                      Type: <span className="font-semibold text-neutral-800">{station.chargerType}</span>
                    </p>
                    <p className="text-neutral-500">
                      Status:{" "}
                      <span className={`font-bold ${isOn ? "text-emerald-600" : "text-amber-600"}`}>
                        {isOn ? "● Available" : "● Occupied"}
                      </span>
                    </p>
                  </div>
                  {onToggleStation && (
                    <button
                      onClick={() => onToggleStation(station.id, !isOn)}
                      className={`w-full py-1.5 text-xs rounded-lg font-bold transition-all ${
                        isOn
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      Mark as {isOn ? "Occupied" : "Available"}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
