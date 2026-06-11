/**
 * TrafficHeatLayer.jsx — Real-time traffic status bar + heat overlay indicator
 * =========================================================================
 * Displays a compact traffic status bar showing current congestion level,
 * delay estimates, and a visual heat indicator for a given route/location.
 *
 * This component does NOT directly modify the Leaflet map. Instead, it:
 *  1. Fetches traffic data from the backend
 *  2. Renders a status bar with color-coded severity
 *  3. Exposes `trafficData` via an optional `onTrafficData` callback so
 *     the parent (MapView) can draw heat overlays on the map.
 *
 * Props:
 *   origin       {string}   — origin coordinates string
 *   destination  {string}   — destination coordinates string
 *   travelMode   {string}   — "WALK" | "CYCLING" | "TRANSIT" | "EV"
 *   onTrafficData {Function} — (data) => void — optional callback
 *   compact      {boolean}  — single-line pill mode
 */

import React, { useEffect, useState, useCallback } from "react";
import { Activity, ArrowRight, Clock, TrendingUp } from "lucide-react";
import api from "../utils/api.js";
import {
  getTrafficSeverity,
  getTrafficColorClass,
  congestionLabel,
  formatDelay,
  trafficIcon,
} from "../utils/trafficUtils.js";

const REFRESH_MS = 90_000; // refresh every 90 seconds

export default function TrafficHeatLayer({
  origin,
  destination,
  travelMode = "TRANSIT",
  onTrafficData,
  compact = false,
}) {
  const [traffic, setTraffic] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTraffic = useCallback(async () => {
    if (!origin || !destination) return;
    setLoading(true);
    try {
      const res = await api.get("/navigation/traffic", {
        params: { origin, destination, mode: travelMode },
      });
      const data = res.data;
      setTraffic(data);
      if (onTrafficData) onTrafficData(data);
    } catch (err) {
      console.warn("[TrafficHeatLayer] Fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, travelMode, onTrafficData]);

  useEffect(() => {
    fetchTraffic();
    const timer = setInterval(fetchTraffic, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchTraffic]);

  if (!origin || !destination) return null;

  // Derive severity from data
  const congestionRatio = traffic?.congestionRatio ?? 0;
  const level           = getTrafficSeverity(congestionRatio);
  const colorClass      = getTrafficColorClass(level);
  const label           = congestionLabel(level);
  const icon            = trafficIcon(level);
  const delay           = traffic?.delayMinutes ?? 0;
  const delayStr        = formatDelay(delay);

  if (compact) {
    return (
      <span
        id="traffic-status-compact"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${colorClass}`}
      >
        <Activity className="w-3 h-3" />
        {icon} {label}
        {delayStr && <span className="opacity-70">({delayStr})</span>}
      </span>
    );
  }

  return (
    <div
      id="traffic-heat-layer-panel"
      className="rounded-xl border border-neutral-800 bg-neutral-950/60 backdrop-blur-sm p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-neutral-500" />
          <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            Live Traffic
          </span>
        </div>
        {loading && (
          <span className="text-3xs text-neutral-600 animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* Severity badge */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass}`}>
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-sm font-bold">{label}</p>
          {delayStr && (
            <p className="text-2xs opacity-70">{delayStr} delay estimated</p>
          )}
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xs opacity-60">Congestion</p>
          <p className="text-sm font-black tabular-nums">
            {Math.round(congestionRatio * 100)}%
          </p>
        </div>
      </div>

      {/* Congestion bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-3xs text-neutral-600">
          <span>Free Flow</span>
          <span>Standstill</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              level === "FREE_FLOW"  ? "bg-emerald-500" :
              level === "LIGHT"     ? "bg-lime-500" :
              level === "MODERATE"  ? "bg-amber-500" :
              level === "HEAVY"     ? "bg-orange-500" : "bg-red-500"
            }`}
            style={{ width: `${Math.round(congestionRatio * 100)}%` }}
          />
        </div>
      </div>

      {/* Route metrics */}
      {traffic && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { Icon: Clock,    label: "Est. Time",  value: traffic.estimatedMinutes ? `${traffic.estimatedMinutes} min` : "--" },
            { Icon: ArrowRight, label: "Distance",  value: traffic.distanceKm ? `${traffic.distanceKm.toFixed(1)} km` : "--" },
            { Icon: TrendingUp, label: "Avg Speed",  value: traffic.avgSpeedKmh ? `${Math.round(traffic.avgSpeedKmh)} km/h` : "--" },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="bg-neutral-900 rounded-lg p-2">
              <Icon className="w-3 h-3 text-neutral-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-white">{value}</p>
              <p className="text-3xs text-neutral-600">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
