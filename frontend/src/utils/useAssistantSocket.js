/**
 * useAssistantSocket — React hook for the Real-Time AI Mobility Assistant
 * =========================================================================
 * Manages the Socket.io lifecycle (connect → authenticate → receive alerts →
 * reconnect on drop) and exposes a reactive `alerts` queue, `navState`,
 * GPS streaming methods, and connection status to any component that mounts it.
 *
 * Usage:
 *   const { alerts, status, dismissAlert, emitGpsUpdate, navState } = useAssistantSocket();
 *
 * Returned values:
 *   alerts              [Array]   — ordered queue of received assistant_message payloads
 *   status              string    — "connecting" | "connected" | "disconnected" | "no_token"
 *   navState            object    — latest nav_update from server (state, bannerInstruction, etc.)
 *   dismissAlert        (id)=>void
 *   clearAlerts         ()=>void
 *   emitGpsUpdate       (lat,lng,speed,heading,stepIdx)=>void — sends gps_update WS event
 *   startGpsStreaming   (intervalMs)=>void — starts periodic GPS emit using geolocation
 *   stopGpsStreaming    ()=>void
 *   subscribeToMonitor  ()=>void — admin only: subscribe to live monitor feed
 *   socketRef           ref to the underlying socket
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

// Maximum alerts to hold in the queue before evicting the oldest
const MAX_QUEUE_SIZE = 20;

export function useAssistantSocket() {
  const [alerts, setAlerts]     = useState([]);
  const [status, setStatus]     = useState("connecting");
  const [navState, setNavState] = useState(null);

  const socketRef         = useRef(null);
  const isMounted         = useRef(true);
  const gpsIntervalRef    = useRef(null);
  const lastSpokenRef     = useRef(null);

  // ── Connection factory ────────────────────────────────────────────────────
  const connect = useCallback(() => {
    const token = localStorage.getItem("greenpath_token");
    if (!token) {
      setStatus("no_token");
      return;
    }

    setStatus("connecting");

    const socket = io(window.location.origin, {
      path: "/ws",
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      autoConnect: false,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (!isMounted.current) return;
      console.log("[AssistantSocket] Transport connected to Socket.io gateway");
    });

    socket.on("connected", (data) => {
      if (!isMounted.current) return;
      console.log("[AssistantSocket] Authenticated & engaged:", data.message);
      setStatus("connected");
    });

    // Live navigation state updates from GPS streaming
    socket.on("nav_update", (payload) => {
      if (!isMounted.current) return;
      setNavState(payload);
    });

    socket.on("assistant_message", (payload) => {
      if (!isMounted.current) return;
      console.log("[AssistantSocket] Received AI alert:", payload);

      const alert = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        receivedAt: new Date().toISOString(),
        priority: payload.type === "ALERT" ? "CRITICAL" :
                  payload.type === "WARNING" ? "HIGH" : "MEDIUM",
        ...payload,
      };

      setAlerts((prev) => {
        // Sort by priority: CRITICAL first, then HIGH, MEDIUM, LOW
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const next = [alert, ...prev].sort((a, b) =>
          (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
        );
        return next.length > MAX_QUEUE_SIZE ? next.slice(0, MAX_QUEUE_SIZE) : next;
      });
    });

    socket.on("connect_error", (err) => {
      if (!isMounted.current) return;
      console.warn("[AssistantSocket] Connection error:", err.message);
      if (err.message && err.message.includes("Authentication failed")) {
        setStatus("no_token");
      } else {
        setStatus("disconnected");
      }
    });

    socket.on("disconnect", (reason) => {
      if (!isMounted.current) return;
      console.log(`[AssistantSocket] Disconnected (reason=${reason})`);
      if (reason === "io server disconnect") {
        socket.connect();
      }
      setStatus("disconnected");
    });

    socket.connect();
  }, []);


  // ── Mount / unmount lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      stopGpsStreaming();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS Streaming ─────────────────────────────────────────────────────────
  /**
   * Emit a single GPS update to the server via WebSocket.
   * @param {number} lat
   * @param {number} lng
   * @param {number} speed  — m/s (optional, 0 if unknown)
   * @param {number} heading — degrees 0-360 (optional)
   * @param {number} stepIndex — current navigation step (optional)
   */
  const emitGpsUpdate = useCallback((lat, lng, speed = 0, heading = 0, stepIndex = 0) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit("gps_update", { lat, lng, speed, heading, stepIndex, timestamp: Date.now() });
  }, []);

  /**
   * Start automatic GPS streaming using the browser Geolocation API.
   * @param {number} intervalMs — how often to emit (default 2000ms)
   */
  const startGpsStreaming = useCallback((intervalMs = 2000) => {
    if (gpsIntervalRef.current) return; // already running
    if (!navigator.geolocation) {
      console.warn("[AssistantSocket] Geolocation not supported");
      return;
    }

    const tick = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          emitGpsUpdate(latitude, longitude, speed ?? 0, heading ?? 0, 0);
        },
        (err) => console.warn("[AssistantSocket] Geolocation error:", err.message),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    };

    tick(); // immediate first tick
    gpsIntervalRef.current = setInterval(tick, intervalMs);
    console.log(`[AssistantSocket] GPS streaming started (every ${intervalMs}ms)`);
  }, [emitGpsUpdate]);

  /** Stop the automatic GPS streaming interval. */
  const stopGpsStreaming = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
      console.log("[AssistantSocket] GPS streaming stopped");
    }
  }, []);

  /**
   * Admin only: subscribe to the live monitor feed.
   * The server will start broadcasting 'monitor_snapshot' events.
   */
  const subscribeToMonitor = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit("subscribe_monitor");
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────
  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    status,
    navState,
    dismissAlert,
    clearAlerts,
    emitGpsUpdate,
    startGpsStreaming,
    stopGpsStreaming,
    subscribeToMonitor,
    socketRef,
  };
}
