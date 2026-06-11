import React, { useState, useEffect, useCallback } from "react";
import {
  Navigation,
  Sliders,
  Battery,
  Leaf,
  Clock,
  DollarSign,
  Award,
  CheckCircle2,
  RotateCcw,
  MapPin,
  Zap,
  Bike,
  Bus,
  Shield,
  CloudSun,
} from "lucide-react";
import { tripAPI, evAPI } from "../utils/api.js";
import MapView from "../components/MapView.jsx";
import LocationSearch from "../components/LocationSearch.jsx";
import { useAssistantSocket } from "../utils/useAssistantSocket.js";
import { isVoiceEnabled, setVoiceEnabled } from "../utils/voiceAssistant.js";
import VoiceNavigator from "../components/VoiceNavigator.jsx";
import { getTrafficColorClass, congestionLabel } from "../utils/trafficUtils.js";

// ─────────────────────────────────────────────────────────────────────────────
// MODE META: labels, icons, color tokens
// ─────────────────────────────────────────────────────────────────────────────
const MODE_META = {
  EV: {
    label: "Electric Vehicle",
    Icon: Zap,
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    ring: "border-emerald-500/40 ring-emerald-500/20",
  },
  CYCLING: {
    label: "Cycling",
    Icon: Bike,
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    ring: "border-sky-500/40 ring-sky-500/20",
  },
  TRANSIT: {
    label: "Transit / Walk",
    Icon: Bus,
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    ring: "border-violet-500/40 ring-violet-500/20",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PlanTrip({ theme }) {
  // Text in the inputs (display)
  const [origin,      setOrigin]      = useState("Kolhapur Railway Station");
  const [destination, setDestination] = useState("Shivaji University, Kolhapur");
  // Resolved coords from autocomplete selection (or null → backend geocodes from text)
  const [originCoords,      setOriginCoords]      = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [co2Weight, setCo2Weight] = useState(1.0);
  const [timeWeight, setTimeWeight] = useState(0.8);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [comparisonResult, setComparisonResult] = useState(null);
  const [selectedMode, setSelectedMode] = useState("EV");
  const [offRoutePosition, setOffRoutePosition] = useState(null);
  const [locating, setLocating] = useState(false);

  const handleUseGPSLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Store exact coords so compare skips re-geocoding
        setOriginCoords([latitude, longitude]);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "User-Agent": "GreenPath-SustainableTransitHub/1.0" } }
          );
          if (res.ok) {
            const data = await res.json();
            setOrigin(data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          } else {
            setOrigin(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
        } catch (err) {
          setOrigin(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setError("Unable to retrieve your location: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // WebSocket Hook integration and Voice State
  const { navState, status: wsStatus } = useAssistantSocket();
  const [voiceEnabled, setVoiceEnabledState] = useState(isVoiceEnabled());

  const handleToggleVoice = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabledState(nextVal);
    setVoiceEnabled(nextVal);
  };

  // ── Compare handler ────────────────────────────────────────────────────
  const handleCompare = async (e, overrideOrigin, overrideDestination, overrideOriginCoords, overrideDestCoords) => {
    if (e) e.preventDefault();

    // Prefer resolved lat/lng array when available, else use text (backend geocodes)
    const sendOrigin      = overrideOriginCoords ?? originCoords ?? (overrideOrigin ?? origin);
    const sendDestination = overrideDestCoords   ?? destinationCoords ?? (overrideDestination ?? destination);

    if (!sendOrigin || !sendDestination) {
      setError("Please fill in both origin and destination.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");
    setComparisonResult(null);
    setOffRoutePosition(null);

    try {
      const preferences = { co2Weight, timeWeight };
      const data = await tripAPI.compare(
        sendOrigin,
        sendDestination,
        preferences,
        batteryLevel
      );
      setComparisonResult(data);
      setSelectedMode("EV");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Failed to compare routes. Ensure the backend and OSRM are reachable."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Save chosen trip ───────────────────────────────────────────────────
  const handleSaveTrip = async (modeKey) => {
    if (!comparisonResult) return;

    const option = comparisonResult.options[modeKey];
    const tripPayload = {
      origin: comparisonResult.origin,
      destination: comparisonResult.destination,
      chosenMode: modeKey,
      co2Emissions: option.co2Kg,
      pointsEarned: option.pointsEstimate,
      timeEstimate: option.timeMinutes,
      costEstimate: option.costUsd,
      geometryData: JSON.stringify(option.geometry),
      distanceKm: option.distanceKm || comparisonResult.distanceKm,
    };

    try {
      setError("");
      setSuccessMsg("");
      await tripAPI.save(tripPayload);
      setSuccessMsg(
        `${modeKey} journey logged! You saved ${option.co2SavingKg} kg CO₂ and earned ${option.pointsEstimate} eco-points.`
      );
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Please log in to save your trip."
      );
    }
  };

  // ── Toggle station availability ────────────────────────────────────────
  const handleToggleStationAvailability = async (stationId, isAvailable) => {
    try {
      await evAPI.toggleStatus(stationId, isAvailable);
      if (comparisonResult) {
        const updated = comparisonResult.nearbyStations.map((s) =>
          s.id === stationId ? { ...s, isAvailable } : s
        );
        setComparisonResult({ ...comparisonResult, nearbyStations: updated });
      }
    } catch (err) {
      console.error("Error updating station:", err);
      setError("Failed to update charger availability.");
    }
  };

  // ── Off-route handler: re-plan from current position ──────────────────
  const handleOffRoute = useCallback((currentPos) => {
    setOffRoutePosition(currentPos);
  }, []);

  const handleReplan = () => {
    if (!offRoutePosition || !comparisonResult) return;
    const coordStr = `${offRoutePosition[0].toFixed(6)},${offRoutePosition[1].toFixed(6)}`;
    handleCompare(null, coordStr, comparisonResult.destination);
  };

  const selectedRouteDetails = comparisonResult?.options[selectedMode];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-10 animate-fade-in transition-colors duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch min-h-[calc(100vh-160px)]">

        {/* ── Left Panel ── */}
        <div className="lg:col-span-5 flex flex-col space-y-5">

          {/* Header */}
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
              <Navigation className="w-8 h-8 text-primary" />
              Plan Sustainable Journey
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              Live OSRM routing with real distances, carbon math, and eco-scoring.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleCompare}
            className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 space-y-5 transition-colors"
          >
            <div className="space-y-4">
              {/* Origin */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    📍 Origin
                  </label>
                  <button
                    type="button"
                    onClick={handleUseGPSLocation}
                    disabled={locating}
                    className="text-3xs text-primary dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold focus:outline-none"
                  >
                    {locating ? (
                      <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-primary/40 border-t-primary rounded-full" />
                    ) : "📡"}
                    {locating ? "Locating…" : "Use My GPS"}
                  </button>
                </div>
                <LocationSearch
                  id="origin-input"
                  value={origin}
                  onChange={(v) => {
                    setOrigin(v);
                    setOriginCoords(null); // clear resolved coords if user types manually
                  }}
                  onSelect={({ displayName, lat, lng }) => {
                    setOrigin(displayName);
                    setOriginCoords([lat, lng]);
                  }}
                  placeholder="City, landmark or address…"
                  icon={<MapPin className="w-3.5 h-3.5 text-emerald-500" />}
                />
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 mb-1.5">
                  🏁 Destination
                </label>
                <LocationSearch
                  id="destination-input"
                  value={destination}
                  onChange={(v) => {
                    setDestination(v);
                    setDestinationCoords(null);
                  }}
                  onSelect={({ displayName, lat, lng }) => {
                    setDestination(displayName);
                    setDestinationCoords([lat, lng]);
                  }}
                  placeholder="City, landmark or address…"
                  icon={<MapPin className="w-3.5 h-3.5 text-red-500" />}
                />
              </div>
            </div>

            {/* Weights Sliders */}
            <div className="border-t border-neutral-200 dark:border-neutral-900 pt-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                Scoring Preferences
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    <span>CO₂ Savings Weight (w1)</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-bold">
                      {co2Weight.toFixed(1)}
                    </span>
                  </div>
                  <input
                    id="co2-weight-slider"
                    type="range"
                    min="0" max="2" step="0.1"
                    value={co2Weight}
                    onChange={(e) => setCo2Weight(parseFloat(e.target.value))}
                    className="w-full accent-primary bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none h-1"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    <span>Time Penalty Weight (w2)</span>
                    <span className="text-indigo-500 dark:text-indigo-400 font-bold">
                      {timeWeight.toFixed(1)}
                    </span>
                  </div>
                  <input
                    id="time-weight-slider"
                    type="range"
                    min="0" max="2" step="0.1"
                    value={timeWeight}
                    onChange={(e) => setTimeWeight(parseFloat(e.target.value))}
                    className="w-full accent-primary bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none h-1"
                  />
                </div>
              </div>
            </div>

            {/* Battery Slider */}
            <div className="border-t border-neutral-200 dark:border-neutral-900 pt-4">
              <div className="flex justify-between items-center text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                <span className="flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5 text-neutral-400" />
                  EV Battery Profile
                </span>
                <span
                  className={`font-bold ${
                    batteryLevel < 25
                      ? "text-red-500"
                      : batteryLevel < 50
                      ? "text-amber-500"
                      : "text-neutral-900 dark:text-white"
                  }`}
                >
                  {batteryLevel}%
                  {batteryLevel < 25 && " ⚡ Low charge penalty"}
                </span>
              </div>
              <input
                id="battery-slider"
                type="range"
                min="5" max="100" step="5"
                value={batteryLevel}
                onChange={(e) => setBatteryLevel(parseInt(e.target.value))}
                className="w-full accent-primary bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none h-1"
              />
            </div>

            <button
              id="compare-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20"
            >
              {loading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                  Computing OSRM Routes…
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  Compare Travel Options
                </>
              )}
            </button>
          </form>

          {/* Off-route Re-plan Banner */}
          {offRoutePosition && comparisonResult && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Off route detected
                </p>
                <p className="text-2xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Your location is &gt;150m from the active route.
                </p>
              </div>
              <button
                id="replan-btn"
                onClick={handleReplan}
                className="flex-shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Re-plan
              </button>
            </div>
          )}

          {/* Feedback Alerts */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Results Panel */}
          {comparisonResult && (
            <div className="space-y-4 flex-grow overflow-y-auto pr-1">
              {/* Route Summary */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                  Mode Comparison
                </h3>
                <span className="text-2xs text-neutral-500 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-2 py-0.5 rounded-full font-medium">
                  {comparisonResult.distanceKm} km via OSRM
                </span>
              </div>

              <div className="space-y-3">
                {Object.entries(comparisonResult.options).map(([key, opt]) => {
                  const isSelected = selectedMode === key;
                  const meta = MODE_META[key] || MODE_META.EV;
                  const ModeIcon = meta.Icon;

                  return (
                    <div
                      key={key}
                      id={`mode-card-${key.toLowerCase()}`}
                      onClick={() => setSelectedMode(key)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden ${
                        isSelected
                          ? `bg-white dark:bg-neutral-900 ${meta.ring} shadow-md ring-1`
                          : "bg-neutral-50 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-800"
                      }`}
                    >
                      {/* Mode Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg border ${meta.badge}`}
                          >
                            <ModeIcon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span
                              className={`text-2xs font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide border ${meta.badge}`}
                            >
                              {meta.label}
                            </span>
                            <h4 className="text-xl font-bold text-neutral-900 dark:text-white mt-0.5">
                              {opt.timeMinutes}{" "}
                              <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                                mins
                              </span>
                            </h4>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-3xs text-neutral-500 dark:text-neutral-400 block">
                            Eco Score
                          </span>
                          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                            {opt.score}
                          </span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 gap-2 border-t border-neutral-200 dark:border-neutral-900 pt-3 text-2xs text-neutral-500 dark:text-neutral-400">
                        <div className="flex flex-col items-center gap-0.5">
                          <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {opt.co2Kg}kg
                          </span>
                          <span>CO₂</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <DollarSign className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            ${opt.costUsd.toFixed(2)}
                          </span>
                          <span>Cost</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            +{opt.pointsEstimate}
                          </span>
                          <span>Points</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {opt.distanceKm}km
                          </span>
                          <span>Dist</span>
                        </div>
                      </div>

                      {/* Live Badges */}
                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-900/80">
                        {/* Traffic badge for EV and TRANSIT */}
                        {(key === "EV" || key === "TRANSIT") && (
                          <span className={`text-3xs font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getTrafficColorClass(comparisonResult.trafficLevel)}`}>
                            Traffic: {congestionLabel(comparisonResult.trafficLevel)}
                          </span>
                        )}
                        {/* Weather badge */}
                        {comparisonResult.weatherInfo && (
                          <span className="text-3xs font-semibold px-2 py-0.5 rounded border bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
                            <CloudSun className="w-2.5 h-2.5 text-amber-500" />
                            {comparisonResult.weatherInfo.condition} ({comparisonResult.weatherInfo.temp}°C)
                          </span>
                        )}
                        {/* Safety score */}
                        {opt.safetyScore !== undefined && (
                          <span className={`text-3xs font-bold px-2 py-0.5 rounded border flex items-center gap-1 uppercase tracking-wider ${
                            opt.safetyScore >= 80 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                          }`}>
                            <Shield className="w-2.5 h-2.5" />
                            Safety: {opt.safetyScore}/100
                          </span>
                        )}
                      </div>

                      {/* CO2 Saving Badge */}
                      {opt.co2SavingKg > 0 && (
                        <div className="mt-2 text-2xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 rounded px-2 py-1 font-medium">
                          Saves {opt.co2SavingKg} kg CO₂ vs. gasoline car
                        </div>
                      )}

                      {/* Select & Log Button */}
                      {isSelected && (
                        <button
                          id={`save-trip-${key.toLowerCase()}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveTrip(key);
                          }}
                          className="w-full mt-3 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold rounded-lg border border-neutral-800 dark:border-neutral-100 text-xs transition-all"
                        >
                          Select &amp; Log Journey
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Voice Navigator HUD */}
          {comparisonResult && (
            <div className="mt-2">
              <VoiceNavigator
                navState={navState}
                enabled={voiceEnabled}
                onToggle={handleToggleVoice}
              />
            </div>
          )}
        </div>

        {/* ── Right Map Panel ── */}
        <div className="lg:col-span-7 h-[420px] lg:h-auto flex flex-col">
          <div className="flex-grow rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20 relative shadow-2xl">
            <MapView
              startCoords={comparisonResult?.startCoords}
              endCoords={comparisonResult?.endCoords}
              routeGeometry={selectedRouteDetails?.geometry}
              nearbyStations={comparisonResult?.nearbyStations || []}
              travelMode={selectedMode}
              onToggleStation={handleToggleStationAvailability}
              onOffRoute={handleOffRoute}
              theme={theme}
            />

            {/* Empty state overlay */}
            {!comparisonResult && !loading && (
              <div className="absolute inset-0 bg-white/90 dark:bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-[1000] transition-colors">
                <Navigation className="w-12 h-12 text-neutral-400 dark:text-neutral-600 mb-4 animate-bounce" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                  No Active Route
                </h3>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-sm">
                  Enter an origin and destination to compute live OSRM routes
                  and trace optimal eco-paths.
                </p>
              </div>
            )}

            {/* Loading state overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-[1000]">
                <div className="animate-spin w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full mb-3" />
                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Fetching OSRM routes…
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                  Geocoding addresses &amp; querying routing engine
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
