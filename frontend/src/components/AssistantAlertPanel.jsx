/**
 * AssistantAlertPanel
 * ====================
 * Renders the live Real-Time AI Mobility Assistant alert feed as a
 * fixed, non-intrusive overlay in the bottom-right corner of the screen.
 *
 * Features:
 *  - Animates each alert in from the right with a slide+fade entrance
 *  - Color-codes by type: WARNING=amber, ALERT=red, SUGGESTION=emerald
 *  - Auto-dismisses after 8 seconds unless the user interacts
 *  - Connection status indicator (pulsing dot)
 *  - "Clear all" button when more than one alert is queued
 *
 * Props:
 *   alerts        {Array}    — from useAssistantSocket
 *   status        {string}   — "connected" | "disconnected" | "connecting" | "no_token"
 *   onDismiss     {Function} — (id) => void
 *   onClearAll    {Function} — () => void
 */

import React, { useEffect, useRef } from "react";
import {
  AlertTriangle,
  Zap,
  Lightbulb,
  X,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

// ─── Priority meta lookup ───────────────────────────────────────────────────
const PRIORITY_META = {
  CRITICAL: {
    Icon: Zap,
    label: "Critical Alert",
    base: "bg-red-500/10 border-red-500/60 text-red-700 dark:text-red-400 border-2 shadow-red-500/20 shadow-lg animate-pulse",
    iconColor: "text-red-500 animate-bounce",
    badge: "bg-red-500/20 text-red-600 dark:text-red-400 font-extrabold",
    bar: null, // no progress bar (explicit dismiss)
  },
  HIGH: {
    Icon: AlertTriangle,
    label: "High Warning",
    base: "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400",
    iconColor: "text-amber-500",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold",
    bar: "bg-amber-500",
    duration: 8000,
  },
  MEDIUM: {
    Icon: Lightbulb,
    label: "Suggestion",
    base: "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
    iconColor: "text-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    duration: 6000,
  },
  LOW: {
    Icon: Lightbulb,
    label: "Update",
    base: "bg-neutral-500/10 border-neutral-500/30 text-neutral-600 dark:text-neutral-400",
    iconColor: "text-neutral-500",
    badge: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400",
    bar: "bg-neutral-500",
    duration: 4000,
  },
};

// ─── Status indicator ─────────────────────────────────────────────────────────
function StatusDot({ status }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1 text-emerald-500 text-3xs font-semibold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Live
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="flex items-center gap-1 text-amber-500 text-3xs font-semibold">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Connecting
      </span>
    );
  }
  if (status === "disconnected") {
    return (
      <span className="flex items-center gap-1 text-neutral-500 text-3xs font-semibold">
        <WifiOff className="w-2.5 h-2.5" />
        Offline
      </span>
    );
  }
  return null; // no_token — don't show the panel at all
}

// ─── Single alert card ────────────────────────────────────────────────────────
function AlertCard({ alert, onDismiss }) {
  // Fallback map if priority not defined
  const priority = alert.priority || (alert.type === "ALERT" ? "CRITICAL" : alert.type === "WARNING" ? "HIGH" : "MEDIUM");
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.MEDIUM;
  const TypeIcon = meta.Icon;
  const timerRef = useRef(null);

  // Auto-dismiss if configured
  useEffect(() => {
    if (meta.duration) {
      timerRef.current = setTimeout(() => onDismiss(alert.id), meta.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alert.id, onDismiss, meta.duration]);

  const formattedTime = new Date(alert.receivedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className={`
        relative flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-sm
        transition-all duration-300 animate-slide-in-right
        ${meta.base}
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Auto-dismiss progress bar */}
      {meta.bar && meta.duration && (
        <div
          className={`absolute bottom-0 left-0 h-0.5 rounded-b-xl ${meta.bar} opacity-40`}
          style={{ animation: `assistant-timer ${meta.duration / 1000}s linear forwards` }}
        />
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${meta.iconColor}`}>
        <TypeIcon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.badge}`}>
            {meta.label}
          </span>
          {alert.actionRequired && (
            <span className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">
              Action Required
            </span>
          )}
        </div>
        <p className="text-xs font-medium leading-snug text-neutral-900 dark:text-white mt-1">
          {alert.message}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-3xs text-neutral-500 dark:text-neutral-500">
            {formattedTime}
          </span>
          {alert.sourceEvent && (
            <span className="text-3xs text-neutral-400 dark:text-neutral-600 font-mono">
              {alert.sourceEvent}
            </span>
          )}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(alert.id)}
        className="flex-shrink-0 p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        aria-label="Dismiss alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function AssistantAlertPanel({ alerts, status, onDismiss, onClearAll }) {
  // Don't render if not authenticated
  if (status === "no_token") return null;

  // Let's sort the alerts in the panel too (just in case they weren't sorted)
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedAlerts = [...alerts].sort((a, b) => {
    const pA = a.priority || (a.type === "ALERT" ? "CRITICAL" : a.type === "WARNING" ? "HIGH" : "MEDIUM");
    const pB = b.priority || (b.type === "ALERT" ? "CRITICAL" : b.type === "WARNING" ? "HIGH" : "MEDIUM");
    const orderDiff = (priorityOrder[pA] ?? 3) - (priorityOrder[pB] ?? 3);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(); // recency
  });

  return (
    <div
      id="assistant-alert-panel"
      className="fixed bottom-6 right-4 z-[2000] flex flex-col gap-2 w-80 max-h-[80vh] overflow-y-auto pointer-events-none"
    >
      {/* Header bar — always visible */}
      <div className="pointer-events-auto flex items-center justify-between px-3 py-1.5 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <Wifi className="w-3 h-3 text-neutral-400 dark:text-neutral-600" />
          <span className="text-3xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Mobility Assistant
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          {sortedAlerts.length > 1 && (
            <button
              onClick={onClearAll}
              className="text-3xs text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 font-semibold transition-colors"
            >
              Clear all ({sortedAlerts.length})
            </button>
          )}
        </div>
      </div>

      {/* Alert cards */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        {sortedAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}
