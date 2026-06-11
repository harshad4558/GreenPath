/**
 * WeatherWidget.jsx — Compact live weather panel
 * =========================================================================
 * Fetches current weather from backend and displays condition + impact
 * on active travel mode. Refreshes every 5 minutes automatically.
 *
 * Props:
 *   travelMode {string} — "WALK" | "CYCLING" | "TRANSIT" | "EV" (optional)
 *   compact    {boolean} — if true, renders a single-line pill badge
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Cloud, CloudRain, CloudSnow, Sun, Zap, Wind,
  Thermometer, Droplets, Eye, RefreshCw,
} from "lucide-react";
import api from "../utils/api.js";
import { weatherModeImpact } from "../utils/trafficUtils.js";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function conditionIcon(condition = "") {
  const c = condition.toLowerCase();
  if (c.includes("snow") || c.includes("blizzard"))             return <CloudSnow className="w-5 h-5 text-blue-300" />;
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return <CloudRain className="w-5 h-5 text-blue-400" />;
  if (c.includes("storm") || c.includes("thunder"))             return <Zap className="w-5 h-5 text-amber-400" />;
  if (c.includes("wind") || c.includes("gust"))                 return <Wind className="w-5 h-5 text-teal-400" />;
  if (c.includes("cloud") || c.includes("overcast"))            return <Cloud className="w-5 h-5 text-neutral-400" />;
  return <Sun className="w-5 h-5 text-amber-400" />;
}

function conditionBadgeClass(condition = "") {
  const c = condition.toLowerCase();
  if (c.includes("storm") || c.includes("thunder"))  return "bg-amber-500/10 border-amber-500/30 text-amber-500";
  if (c.includes("snow"))                            return "bg-blue-500/10 border-blue-500/30 text-blue-400";
  if (c.includes("rain"))                            return "bg-blue-400/10 border-blue-400/30 text-blue-400";
  if (c.includes("wind"))                            return "bg-teal-500/10 border-teal-500/30 text-teal-400";
  if (c.includes("cloud"))                           return "bg-neutral-400/10 border-neutral-400/30 text-neutral-400";
  return "bg-amber-400/10 border-amber-400/30 text-amber-400";
}

export default function WeatherWidget({ travelMode = null, compact = false, lat = 51.505, lng = -0.09 }) {
  const [weather, setWeather]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/navigation/weather", {
        params: { lat, lng }
      });
      setWeather(res.data);
      setLastUpdate(new Date());
      setError("");
    } catch (err) {
      setError("Weather unavailable");
      console.warn("[WeatherWidget] Fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    fetchWeather();
    const timer = setInterval(fetchWeather, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchWeather]);

  if (loading && !weather) {
    return compact ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-xs text-neutral-400 animate-pulse">
        <Cloud className="w-3 h-3" /> Loading weather…
      </span>
    ) : (
      <div className="h-24 rounded-xl bg-neutral-900 border border-neutral-800 animate-pulse" />
    );
  }

  if (error && !weather) {
    return compact ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-xs text-neutral-500">
        <Cloud className="w-3 h-3" /> --
      </span>
    ) : null;
  }

  const condition = weather?.condition ?? "Clear";
  const temp      = weather?.temperature ?? "--";
  const humidity  = weather?.humidity ?? "--";
  const windSpeed = weather?.windSpeed ?? "--";
  const badgeClass = conditionBadgeClass(condition);
  const impact     = travelMode ? weatherModeImpact(condition, travelMode) : null;

  if (compact) {
    return (
      <span
        id="weather-widget-compact"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${badgeClass}`}
        title={`Temperature: ${temp}°C | Humidity: ${humidity}% | Wind: ${windSpeed} km/h`}
      >
        {conditionIcon(condition)}
        {condition}
        {typeof temp === "number" && <span className="opacity-70 font-normal">{temp}°C</span>}
      </span>
    );
  }

  return (
    <div
      id="weather-widget-full"
      className="rounded-xl border border-neutral-800 bg-neutral-950/60 backdrop-blur-sm p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {conditionIcon(condition)}
          <div>
            <p className="text-sm font-bold text-white">{condition}</p>
            <p className="text-2xs text-neutral-500">Current Conditions</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white tabular-nums">{temp}°</p>
          <button
            onClick={fetchWeather}
            className="text-neutral-600 hover:text-neutral-300 transition-colors mt-0.5"
            title="Refresh weather"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { Icon: Thermometer, label: "Feels like", value: `${typeof temp === "number" ? temp - 1 : "--"}°` },
          { Icon: Droplets,   label: "Humidity",   value: `${humidity}%` },
          { Icon: Wind,       label: "Wind",       value: `${windSpeed} km/h` },
        ].map(({ Icon, label, value }) => (
          <div
            key={label}
            className="bg-neutral-900 rounded-lg p-2 text-center"
          >
            <Icon className="w-3.5 h-3.5 text-neutral-500 mx-auto mb-1" />
            <p className="text-xs font-semibold text-white tabular-nums">{value}</p>
            <p className="text-3xs text-neutral-600">{label}</p>
          </div>
        ))}
      </div>

      {/* Mode impact banner */}
      {impact && !impact.suitable && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <Eye className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{impact.reason}</span>
        </div>
      )}
      {impact?.suitable && impact.reason && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs">
          <Eye className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{impact.reason}</span>
        </div>
      )}

      {lastUpdate && (
        <p className="text-3xs text-neutral-700 text-right">
          Updated {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}
