/**
 * Contextual Intelligence Layer — AssistantEngine
 * =================================================
 * Deterministic event processor that:
 *
 *  1. Receives a platform event from any upstream emitter (navigation engine,
 *     station watcher, weather hook, etc.).
 *  2. Performs efficient TypeORM relational joins to build a rich spatial-
 *     preference user context object from User → UserPreferences → active
 *     NavigationSession.
 *  3. Constructs a concise system-prompted LLM request and calls the external
 *     AI completion endpoint (OpenAI-compatible).
 *  4. Validates and re-shapes the returned JSON fragment, then pushes it back
 *     to the originating user's live WebSocket channel via emitAssistantMessage().
 *
 * ── Event Interception Matrix ────────────────────────────────────────────────
 *  NAV_DEVIATION        cross-track error > 30 m  → rerouting notification
 *  TURN_WARNING         distance to step < 50 m   → lane instruction banner
 *  STATION_STATUS_CHANGE EV station availability   → path-modification suggestion
 *  WEATHER_ALERT        environmental degradation  → transit / EV alternative
 *
 * ── LLM Response contract ────────────────────────────────────────────────────
 *  {
 *    "type":           "WARNING" | "SUGGESTION" | "ALERT",
 *    "message":        "<concise copilot string>",
 *    "actionRequired": true | false
 *  }
 */

import { AppDataSource } from "../config/db.js";
import { User, UserPreferences } from "../entities/UserAndPreferences.js";
import { Trip } from "../entities/Trip.js";
import { navigationSessions } from "../controllers/navigationEngine.js";
import { emitAssistantMessage } from "../config/websocket.js";
import eventBus, { EVENTS } from "../events/eventBus.js";

// ─── Accepted platform event types ───────────────────────────────────────────
const VALID_EVENT_TYPES = new Set([
  "NAV_DEVIATION",
  "TURN_WARNING",
  "STATION_STATUS_CHANGE",
  "WEATHER_ALERT",
  "TRAFFIC_ALERT",
  "PREDICTIVE_SUGGESTION",
]);

// ─── LLM configuration ───────────────────────────────────────────────────────
const AI_API_URL =
  process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
const AI_MODEL   = process.env.AI_MODEL   || "gpt-4o-mini";
const AI_API_KEY = process.env.AI_API_KEY || null; // null → deterministic fallback mode

// ─── System prompt (strict JSON-only co-pilot persona) ───────────────────────
const SYSTEM_PROMPT = `You are a concise, real-time navigation co-pilot embedded in a sustainable transport application.
You receive live telemetry events and user context, then return ONLY a single valid JSON object — nothing else.
Your response MUST conform to this exact schema:
{
  "type": "WARNING" | "SUGGESTION" | "ALERT",
  "message": "<one short, actionable sentence — max 120 characters>",
  "actionRequired": true | false
}
Rules:
- Never include markdown fences, preambles, or explanations outside the JSON.
- Keep message under 120 characters. Be direct and human.
- WARNING  → something wrong that needs attention (off-route, bad weather)
- ALERT    → urgent, immediate action required (turn now, station gone offline)
- SUGGESTION → proactive, user-helpful recommendation (swap mode, charge early)
- actionRequired: true only when the user must take immediate physical action.`;

// ─── Per-event deterministic fallbacks (when no AI key is configured) ────────
const FALLBACK_RESPONSES = {
  NAV_DEVIATION: {
    type: "WARNING",
    message: "You are off route. Recalculating the fastest eco-path back.",
    actionRequired: true,
  },
  TURN_WARNING: {
    type: "ALERT",
    message: "Turn approaching in under 50 m. Check your lane position now.",
    actionRequired: true,
  },
  STATION_STATUS_CHANGE: {
    type: "SUGGESTION",
    message: "A charging station on your route changed status. Consider an alternate charger.",
    actionRequired: false,
  },
  WEATHER_ALERT: {
    type: "WARNING",
    message: "Weather conditions have changed. Consider switching to transit or EV mode.",
    actionRequired: false,
  },
  TRAFFIC_ALERT: {
    type: "WARNING",
    message: "Heavy traffic detected ahead. Recalculating alternative path to save time.",
    actionRequired: false,
  },
  PREDICTIVE_SUGGESTION: {
    type: "SUGGESTION",
    message: "Based on your frequent commute history, we suggest using public transit today to save emissions.",
    actionRequired: false,
  },
};

// ─── Helper: build a rich natural-language context block ─────────────────────

/**
 * Constructs the "spatial-preference profile" context string fed to the LLM.
 *
 * @param {object} user          - Full User entity (with preferences relation)
 * @param {object|null} session  - Active NavigationSession or null
 * @param {string} eventType     - Platform event identifier
 * @param {object} payload       - Raw event payload
 * @returns {string}             - Human-readable context string for the LLM
 */
function buildContextBlock(user, session, eventType, payload) {
  const prefs = user.preferences ?? {};

  const lines = [
    `EVENT TYPE: ${eventType}`,
    `EVENT PAYLOAD: ${JSON.stringify(payload)}`,
    `---`,
    `USER PROFILE:`,
    `  Routing priority: ${prefs.routingPriority ?? "BALANCE"}`,
    `  EV charging preference: ${prefs.evChargingPreference ?? "ANY"}`,
    `  Prefers cycling: ${prefs.preferCycling ?? false}`,
    `  Avoid unsafe zones: ${prefs.avoidUnsafeZones ?? false}`,
    `  Eco points accumulated: ${user.ecoPoints ?? 0}`,
    `  Total CO₂ saved: ${user.totalCo2Saved ?? 0} kg`,
  ];

  if (session) {
    lines.push(
      `---`,
      `ACTIVE NAVIGATION SESSION:`,
      `  Travel mode: ${session.travelMode}`,
      `  Session state: ${session.state}`,
      `  Distance remaining: ${Math.round((session.distanceM ?? 0) / 1000 * 100) / 100} km`,
      `  Duration remaining: ${Math.round((session.durationS ?? 0) / 60)} min`,
      `  CO₂ on current route: ${session.co2Emissions?.toFixed?.(2) ?? "N/A"} g`,
      `  Step index: ${session.currentStepIndex ?? 0} of ${(session.steps?.length ?? 1) - 1}`,
      `  Traffic Level: ${session.trafficLevel ?? payload.trafficLevel ?? "LOW"}`,
      `  Weather: ${session.weatherInfo ? JSON.stringify(session.weatherInfo) : payload.weatherInfo ? JSON.stringify(payload.weatherInfo) : "Clear, 25°C"}`,
    );
  } else {
    lines.push(
      `---`,
      `ACTIVE NAVIGATION SESSION: none (user not currently navigating)`,
      `  Current Traffic Level: ${payload.trafficLevel ?? "LOW"}`,
      `  Current Weather: ${payload.weatherInfo ? JSON.stringify(payload.weatherInfo) : "Clear, 25°C"}`
    );
  }

  return lines.join("\n");
}

// ─── Helper: call the LLM completion API ─────────────────────────────────────

/**
 * Sends the context to the external AI completion endpoint and returns the
 * parsed JSON response object.
 *
 * Throws on network errors; returns a safe fallback on parse failures.
 *
 * @param {string} contextBlock
 * @param {string} eventType
 * @returns {Promise<{type: string, message: string, actionRequired: boolean}>}
 */
async function callAICompletionAPI(contextBlock, eventType) {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.35,      // Low temp → deterministic, consistent instructions
      max_tokens: 120,
      response_format: { type: "json_object" }, // gpt-4o-mini supports structured output
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Process this navigation event and return the JSON response:\n\n${contextBlock}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`AI API HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const json = await response.json();
  const rawContent = json?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("AI API returned an empty completion");
  }

  // Parse and validate the LLM output
  const parsed = JSON.parse(rawContent);

  const VALID_TYPES = new Set(["WARNING", "SUGGESTION", "ALERT"]);
  if (
    !VALID_TYPES.has(parsed.type) ||
    typeof parsed.message !== "string" ||
    typeof parsed.actionRequired !== "boolean"
  ) {
    throw new Error("AI response schema validation failed");
  }

  // Enforce max message length
  parsed.message = parsed.message.slice(0, 120);

  return parsed;
}

// ─── Main exported class ──────────────────────────────────────────────────────

export class AssistantEngine {
  /**
   * Process a single platform event for a given user.
   *
   * Workflow:
   *  1. Validate event type
   *  2. Load User + UserPreferences via TypeORM (single LEFT JOIN query)
   *  3. Snapshot the active NavigationSession from the in-memory Map
   *  4. Build the context block
   *  5. Attempt LLM call; fall back to deterministic response on any failure
   *  6. Push the result to the user's live WebSocket connection
   *
   * @param {string} userId    - UUID matching the JWT payload id
   * @param {string} eventType - One of the four platform event identifiers
   * @param {object} payload   - Raw event-specific data object
   * @returns {Promise<{type: string, message: string, actionRequired: boolean}>}
   *          The assistant response (also pushed over WS)
   */
  async processSystemEvent(userId, eventType, payload = {}) {
    // ── Step 1: Guard — validate incoming event type ─────────────────────────
    if (!VALID_EVENT_TYPES.has(eventType)) {
      const errMsg = `[AssistantEngine] Unknown event type: "${eventType}". ` +
        `Accepted: ${[...VALID_EVENT_TYPES].join(", ")}`;
      console.warn(errMsg);
      throw new Error(errMsg);
    }

    console.log(
      `[AssistantEngine] Processing event="${eventType}" for user="${userId}"`
    );

    // ── Step 2: Efficient relational join — User + UserPreferences ───────────
    // We use QueryBuilder with a single LEFT JOIN to avoid the N+1 problem.
    // If the database is unavailable we degrade gracefully with a minimal user object.
    let user = null;
    try {
      user = await AppDataSource.getRepository(User).findOne({
        where: { id: userId },
        relations: ["preferences"]
      });
    } catch (dbErr) {
      console.warn(
        `[AssistantEngine] DB unavailable, degrading to anonymous context: ${dbErr.message}`
      );
    }

    // Minimal anonymous profile if DB lookup fails or user not found
    if (!user) {
      user = {
        id: userId,
        ecoPoints: 0,
        totalCo2Saved: 0,
        preferences: {
          routingPriority: "BALANCE",
          evChargingPreference: "ANY",
          preferCycling: false,
          avoidUnsafeZones: false,
        },
      };
    }

    // ── Step 3: Snapshot the active NavigationSession ────────────────────────
    // navigationSessions is the in-memory Map exported by navigationEngine.js.
    const session = navigationSessions.get(userId) ?? null;

    // ── Step 4: Build the spatial-preference context string ──────────────────
    const contextBlock = buildContextBlock(user, session, eventType, payload);

    // ── Step 5: Obtain the AI response ───────────────────────────────────────
    let assistantResponse;

    if (!AI_API_KEY) {
      // No API key configured — use deterministic fallbacks (ideal for dev/demo)
      console.log(
        "[AssistantEngine] AI_API_KEY not set — using deterministic fallback response"
      );
      assistantResponse = { ...FALLBACK_RESPONSES[eventType] };
    } else {
      try {
        assistantResponse = await callAICompletionAPI(contextBlock, eventType);
        console.log(
          `[AssistantEngine] LLM responded: type=${assistantResponse.type}`
        );
      } catch (aiErr) {
        console.error(
          `[AssistantEngine] LLM call failed, using fallback. Reason: ${aiErr.message}`
        );
        assistantResponse = { ...FALLBACK_RESPONSES[eventType] };
      }
    }

    // ── Step 6: Push to the user's live WebSocket channel ────────────────────
    const wsPayload = {
      ...assistantResponse,
      sourceEvent: eventType,
      eventPayload: payload,
      userId,
    };

    const delivered = emitAssistantMessage(userId, wsPayload);

    if (!delivered) {
      console.warn(
        `[AssistantEngine] User "${userId}" has no active WebSocket connection. ` +
          "Alert not delivered (user offline)."
      );
    }

    return assistantResponse;
  }

  // ─── Convenience static factory methods for each event type ───────────────
  // These allow any module to emit typed events with minimal boilerplate:
  //   await AssistantEngine.navDeviation(userId, { deviationM: 45 });

  /**
   * Emit a NAV_DEVIATION event.
   * @param {string} userId
   * @param {{ deviationM: number, userLat: number, userLng: number }} payload
   */
  static async navDeviation(userId, payload) {
    return new AssistantEngine().processSystemEvent(
      userId,
      "NAV_DEVIATION",
      payload
    );
  }

  /**
   * Emit a TURN_WARNING event.
   * @param {string} userId
   * @param {{ distToTurnM: number, instruction: string, stepModifier?: string }} payload
   */
  static async turnWarning(userId, payload) {
    return new AssistantEngine().processSystemEvent(
      userId,
      "TURN_WARNING",
      payload
    );
  }

  /**
   * Emit a STATION_STATUS_CHANGE event.
   * @param {string} userId
   * @param {{ stationId: string, stationName: string, isAvailable: boolean }} payload
   */
  static async stationStatusChange(userId, payload) {
    return new AssistantEngine().processSystemEvent(
      userId,
      "STATION_STATUS_CHANGE",
      payload
    );
  }

  /**
   * Emit a WEATHER_ALERT event.
   * @param {string} userId
   * @param {{ condition: string, severity: string, currentMode: string }} payload
  /**
   * Emit a WEATHER_ALERT event.
   * @param {string} userId
   * @param {{ condition: string, severity: string, currentMode: string }} payload
   */
  static async weatherAlert(userId, payload) {
    return new AssistantEngine().processSystemEvent(
      userId,
      "WEATHER_ALERT",
      payload
    );
  }

  /**
   * Emit a TRAFFIC_ALERT event.
   * @param {string} userId
   * @param {{ trafficLevel: string, message: string }} payload
   */
  static async trafficAlert(userId, payload) {
    return new AssistantEngine().processSystemEvent(
      userId,
      "TRAFFIC_ALERT",
      payload
    );
  }

  /**
   * Query database for user's past completed trips and emit a predictive suggestion.
   * @param {string} userId
   */
  static async generatePredictiveSuggestion(userId) {
    try {
      const tripRepo = AppDataSource.getRepository(Trip);
      const pastTrips = await tripRepo.find({
        where: { user: { id: userId }, status: "COMPLETED" },
        order: { createdAt: "DESC" },
        take: 3
      });

      if (pastTrips.length > 0) {
        const mostRecent = pastTrips[0];
        const suggestion = `You frequently travel from ${mostRecent.origin} to ${mostRecent.destination}. We suggest using cycling or public transit for this route today!`;
        return new AssistantEngine().processSystemEvent(userId, "PREDICTIVE_SUGGESTION", {
          origin: mostRecent.origin,
          destination: mostRecent.destination,
          suggestion,
          reason: "Pattern analysis matching sustainable transit options."
        });
      } else {
        // Fallback generic suggestion
        return new AssistantEngine().processSystemEvent(userId, "PREDICTIVE_SUGGESTION", {
          suggestion: "Try combining EV charging stops with public transit options today for maximum efficiency.",
          reason: "General sustainability recommendation."
        });
      }
    } catch (err) {
      console.warn("[AssistantEngine] Failed to generate predictive suggestion:", err.message);
    }
  }
}

// ─── Subscribe AssistantEngine to EventBus events ──────────────────────────
eventBus.on(EVENTS.GPS_UPDATED, async ({ userId, lat, lng, speed, heading }) => {
  // GPS telemetry received, no immediate client notification required unless requested
});

eventBus.on(EVENTS.OFF_ROUTE, async ({ userId, deviationM, userLat, userLng, travelMode }) => {
  try {
    await AssistantEngine.navDeviation(userId, { deviationM, userLat, userLng, travelMode });
  } catch (err) {
    console.error("[EventBus Callback] OFF_ROUTE handling error:", err.message);
  }
});

eventBus.on(EVENTS.TURN_APPROACHING, async ({ userId, distToTurnM, instruction, stepModifier, travelMode }) => {
  try {
    await AssistantEngine.turnWarning(userId, { distToTurnM, instruction, stepModifier, travelMode });
  } catch (err) {
    console.error("[EventBus Callback] TURN_APPROACHING handling error:", err.message);
  }
});

eventBus.on(EVENTS.TRAFFIC_ALERT, async ({ userId, trafficLevel, message }) => {
  try {
    await AssistantEngine.trafficAlert(userId, { trafficLevel, message });
  } catch (err) {
    console.error("[EventBus Callback] TRAFFIC_ALERT handling error:", err.message);
  }
});

eventBus.on(EVENTS.PREDICTIVE_SUGGESTION, async ({ userId }) => {
  try {
    await AssistantEngine.generatePredictiveSuggestion(userId);
  } catch (err) {
    console.error("[EventBus Callback] PREDICTIVE_SUGGESTION handling error:", err.message);
  }
});

