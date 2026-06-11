/**
 * Assistant Events Route — /api/assistant
 * =========================================
 * Exposes a protected REST endpoint that lets any authenticated
 * upstream service (weather integrations, admin tooling, test harnesses)
 * inject platform events into the Real-Time AI Mobility Assistant Engine.
 *
 * Routes:
 *   POST /api/assistant/event
 *     Body: { eventType, userId?, payload? }
 *     - Requires valid JWT (authMiddleware)
 *     - If userId is omitted the token's own id is used
 *     - Only ADMIN role may target a different userId
 *
 *   POST /api/assistant/weather-alert
 *     Convenience alias for WEATHER_ALERT events from weather data hooks.
 *     Body: { condition, severity, affectedModes?, userId? }
 */

import express from "express";
import { AssistantEngine } from "../services/assistantEngine.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── Generic event injection (all four platform events) ──────────────────────

/**
 * POST /api/assistant/event
 *
 * Allows any authenticated service or admin tool to fire any platform event
 * against a specific user's AI co-pilot channel.
 *
 * Body:
 *   eventType  {string}  — NAV_DEVIATION | TURN_WARNING | STATION_STATUS_CHANGE | WEATHER_ALERT
 *   userId     {string?} — target user UUID; defaults to the JWT's own id
 *   payload    {object?} — event-specific data forwarded to the engine
 */
router.post("/event", authMiddleware, async (req, res) => {
  try {
    const { eventType, payload = {}, userId: targetUserId } = req.body;

    if (!eventType) {
      return res.status(400).json({ message: "eventType is required." });
    }

    // Users can only target themselves; admins can target any userId
    const resolvedUserId =
      req.user.role === "ADMIN" && targetUserId
        ? targetUserId
        : req.user.id;

    const result = await new AssistantEngine().processSystemEvent(
      resolvedUserId,
      eventType,
      payload
    );

    return res.json({
      message: "Event processed successfully.",
      userId: resolvedUserId,
      eventType,
      assistantResponse: result,
    });
  } catch (err) {
    console.error("[AssistantRoute] Event processing error:", err.message);
    return res.status(err.message.includes("Unknown event type") ? 400 : 500).json({
      message: err.message || "Failed to process assistant event.",
    });
  }
});

// ─── WEATHER_ALERT convenience endpoint ──────────────────────────────────────

/**
 * POST /api/assistant/weather-alert
 *
 * Purpose-built endpoint for weather service webhooks.
 * Automatically constructs the WEATHER_ALERT payload and broadcasts
 * to the requesting user (or, for admin callers, to a specified userId).
 *
 * Body:
 *   condition      {string}  — e.g. "Heavy Rain", "Hailstorm", "Strong Wind"
 *   severity       {string}  — "LOW" | "MEDIUM" | "HIGH" | "EXTREME"
 *   affectedModes  {string[]} — e.g. ["CYCLING"] — modes negatively impacted
 *   userId         {string?} — admin-only: target user UUID
 *   location       {string?} — human-readable affected area name
 */
router.post("/weather-alert", authMiddleware, async (req, res) => {
  try {
    const {
      condition   = "Adverse weather",
      severity    = "MEDIUM",
      affectedModes = [],
      location    = "current route",
      userId: targetUserId,
    } = req.body;

    if (!condition) {
      return res.status(400).json({ message: "condition is required." });
    }

    const resolvedUserId =
      req.user.role === "ADMIN" && targetUserId
        ? targetUserId
        : req.user.id;

    const payload = {
      condition,
      severity,
      affectedModes,
      location,
    };

    const result = await AssistantEngine.weatherAlert(resolvedUserId, payload);

    return res.json({
      message: "Weather alert processed and pushed to user's AI co-pilot channel.",
      userId: resolvedUserId,
      assistantResponse: result,
    });
  } catch (err) {
    console.error("[AssistantRoute] Weather alert error:", err.message);
    return res.status(500).json({
      message: err.message || "Failed to process weather alert.",
    });
  }
});

// ─── Health check — confirms the assistant engine is reachable ────────────────

/**
 * GET /api/assistant/health
 * Returns engine status and connection count without requiring auth,
 * useful for load-balancer health probes.
 */
router.get("/health", async (req, res) => {
  try {
    const { getConnectionCount } = await import("../config/websocket.js");
    return res.json({
      status: "operational",
      activeConnections: getConnectionCount(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.json({ status: "operational", activeConnections: 0 });
  }
});

export default router;
