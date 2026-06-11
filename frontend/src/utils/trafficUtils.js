/**
 * trafficUtils.js — Traffic severity calculations and color helpers
 * =========================================================================
 * Provides deterministic functions for converting raw traffic data into
 * UI-friendly classes, colors, and labels used across the platform.
 *
 * Import:
 *   import { getTrafficSeverity, getTrafficColor, congestionLabel } from "./trafficUtils.js";
 */

/**
 * Traffic severity levels
 * @typedef {"FREE_FLOW"|"LIGHT"|"MODERATE"|"HEAVY"|"STANDSTILL"} TrafficLevel
 */

/** Map a congestion ratio (0–1) to a semantic traffic level. */
export function getTrafficSeverity(congestionRatio) {
  if (congestionRatio === null || congestionRatio === undefined) return "FREE_FLOW";
  if (congestionRatio < 0.2) return "FREE_FLOW";
  if (congestionRatio < 0.4) return "LIGHT";
  if (congestionRatio < 0.6) return "MODERATE";
  if (congestionRatio < 0.8) return "HEAVY";
  return "STANDSTILL";
}

/** Convert a speed (km/h) + free-flow speed to a congestion ratio. */
export function speedToCongestionRatio(currentSpeed, freeFlowSpeed) {
  if (!freeFlowSpeed || freeFlowSpeed <= 0) return 0;
  const ratio = 1 - currentSpeed / freeFlowSpeed;
  return Math.max(0, Math.min(1, ratio));
}

/** Get Tailwind CSS color classes for a traffic level. */
export function getTrafficColorClass(level) {
  switch (level) {
    case "FREE_FLOW":  return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    case "LIGHT":      return "text-lime-500 bg-lime-500/10 border-lime-500/30";
    case "MODERATE":   return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    case "HEAVY":      return "text-orange-500 bg-orange-500/10 border-orange-500/30";
    case "STANDSTILL": return "text-red-500 bg-red-500/10 border-red-500/30";
    default:           return "text-neutral-500 bg-neutral-500/10 border-neutral-500/30";
  }
}

/** Get a CSS hex color string for rendering on the map. */
export function getTrafficHexColor(level) {
  switch (level) {
    case "FREE_FLOW":  return "#22c55e"; // emerald-500
    case "LIGHT":      return "#84cc16"; // lime-500
    case "MODERATE":   return "#f59e0b"; // amber-500
    case "HEAVY":      return "#f97316"; // orange-500
    case "STANDSTILL": return "#ef4444"; // red-500
    default:           return "#6b7280"; // neutral-500
  }
}

/** Human-readable label for a traffic level. */
export function congestionLabel(level) {
  switch (level) {
    case "FREE_FLOW":  return "Free Flow";
    case "LIGHT":      return "Light Traffic";
    case "MODERATE":   return "Moderate";
    case "HEAVY":      return "Heavy Traffic";
    case "STANDSTILL": return "Standstill";
    default:           return "Unknown";
  }
}

/** Traffic level icon character for compact display. */
export function trafficIcon(level) {
  switch (level) {
    case "FREE_FLOW":  return "🟢";
    case "LIGHT":      return "🟡";
    case "MODERATE":   return "🟠";
    case "HEAVY":      return "🔴";
    case "STANDSTILL": return "⛔";
    default:           return "⚪";
  }
}

/**
 * Given an array of route segment speeds, compute an overall route
 * traffic severity label.
 * @param {number[]} speeds — km/h readings
 * @param {number}   freeFlowSpeed — baseline km/h
 * @returns {TrafficLevel}
 */
export function routeTrafficLevel(speeds, freeFlowSpeed = 50) {
  if (!speeds || speeds.length === 0) return "FREE_FLOW";
  const avgSpeed = speeds.reduce((s, v) => s + v, 0) / speeds.length;
  const ratio = speedToCongestionRatio(avgSpeed, freeFlowSpeed);
  return getTrafficSeverity(ratio);
}

/**
 * Calculate the additional travel time (minutes) due to congestion.
 * @param {number} distanceKm
 * @param {number} currentSpeedKmh
 * @param {number} freeFlowSpeedKmh
 * @returns {number} extra minutes
 */
export function congestionDelayMinutes(distanceKm, currentSpeedKmh, freeFlowSpeedKmh) {
  if (currentSpeedKmh <= 0 || !freeFlowSpeedKmh) return 0;
  const freeFlowTime     = (distanceKm / freeFlowSpeedKmh) * 60;
  const congestionTime   = (distanceKm / currentSpeedKmh) * 60;
  return Math.max(0, congestionTime - freeFlowTime);
}

/**
 * Format a congestion delay number into a compact string.
 * @param {number} delayMinutes
 * @returns {string} e.g. "+8 min"
 */
export function formatDelay(delayMinutes) {
  if (delayMinutes < 1)  return "";
  if (delayMinutes < 60) return `+${Math.round(delayMinutes)} min`;
  const h = Math.floor(delayMinutes / 60);
  const m = Math.round(delayMinutes % 60);
  return m > 0 ? `+${h}h ${m}m` : `+${h}h`;
}

/**
 * Compute weather impact on travel mode suitability.
 * @param {string} weatherCondition — e.g. "Heavy Rain", "Clear", "Snow"
 * @param {string} travelMode       — "WALK" | "CYCLING" | "TRANSIT" | "EV"
 * @returns {{ suitable: boolean, reason: string }}
 */
export function weatherModeImpact(weatherCondition, travelMode) {
  const condition = (weatherCondition || "").toLowerCase();
  const isRain    = condition.includes("rain") || condition.includes("drizzle");
  const isSnow    = condition.includes("snow") || condition.includes("blizzard");
  const isStorm   = condition.includes("storm") || condition.includes("thunder");
  const isHeat    = condition.includes("extreme heat") || condition.includes("heat wave");

  if (travelMode === "WALK") {
    if (isStorm)          return { suitable: false, reason: "Storm conditions – unsafe for walking" };
    if (isSnow)           return { suitable: false, reason: "Snow/ice – walking hazardous" };
    if (isHeat)           return { suitable: false, reason: "Extreme heat – walk with caution" };
    if (isRain)           return { suitable: true,  reason: "Light rain – take an umbrella" };
  }
  if (travelMode === "CYCLING") {
    if (isStorm || isSnow) return { suitable: false, reason: "Cycling not recommended in storm/snow" };
    if (isRain)            return { suitable: true,  reason: "Rain – wet roads, reduce speed" };
  }
  if (travelMode === "EV") {
    if (isSnow)            return { suitable: true,  reason: "Cold weather reduces EV range ~20%" };
  }
  return { suitable: true, reason: "" };
}
