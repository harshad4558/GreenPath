/**
 * WebSocket Gateway — Real-Time AI Mobility Assistant Engine
 * =============================================================
 * Binds a Socket.io server to the existing HTTP application
 * server lifecycle (no separate port, no polling).
 *
 * Handshake: clients MUST send a valid JWT in the auth token
 *   socket.handshake.auth.token
 *
 * After authentication the server attaches `userId` to the socket and
 * registers its `socket.id` in the global `activeConnections` Map so that
 * any module can push targeted events without keeping references to raw sockets.
 *
 * Exported API:
 *   setupWebSocket(server)              — call once from server.js
 *   emitAssistantMessage(userId, payload) — send typed event to one user
 *   getConnectionCount()                — returns count of active users
 */

import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "greenpath_super_secret_key_12345";

/**
 * Thread-safe in-memory registry:
 *   userId (string) → socket.id (string)
 */
const activeConnections = new Map();
const adminConnections = new Map();
let io;

/**
 * Initialize Socket.io and attach to the existing HTTP server.
 *
 * @param {import("http").Server} server
 * @returns {Server} Socket.io Server instance
 */
export function setupWebSocket(server) {
  io = new Server(server, {
    path: "/ws",
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }
  });

  console.log("[WS] Socket.io gateway attached to HTTP server on path /ws");

  // ── Authentication Middleware ──────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        throw new Error("Missing auth token");
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id; // matches the `id` field set by authController
      socket.userRole = decoded.role || "USER";

      if (!socket.userId) {
        throw new Error("Token payload missing `id` field");
      }

      next();
    } catch (err) {
      console.warn("[WS] Rejected unauthenticated connection:", err.message);
      next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  // ── Connection handler ──────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = socket.userId;
    const userRole = socket.userRole;

    // Register connection in our global Map
    activeConnections.set(userId, socket.id);

    // Track admin connections separately
    if (userRole === "ADMIN") {
      adminConnections.set(socket.id, socket);
      console.log(`[WS] Admin connected: ${socket.id} | total admins=${adminConnections.size}`);
    }

    console.log(
      `[WS] User connected: ${userId} (${userRole}) | socketId=${socket.id} | active=${activeConnections.size}`
    );

    // Greet the client with a connected event acknowledgment
    socket.emit("connected", {
      userId,
      message: "Real-Time AI Mobility Assistant engaged.",
    });

    // ── GPS Streaming ──────────────────────────────────────────────────────────
    socket.on("gps_update", async (data, callback) => {
      const { lat, lng, speed, heading, currentStepIndex } = data || {};
      if (lat === undefined || lng === undefined) return;
      try {
        const { processGpsUpdate } = await import("../controllers/navigationEngine.js");
        const result = await processGpsUpdate(userId, lat, lng, speed, heading, currentStepIndex);

        // Send navigation update back to user
        socket.emit("nav_update", result);

        // Broadcast to admins
        broadcastToAdmins({
          type: "GPS_STREAM_UPDATE",
          userId,
          lat,
          lng,
          speed,
          heading,
          navState: result
        });

        if (typeof callback === "function") {
          callback(result);
        }
      } catch (err) {
        console.error(`[WS] gps_update error for user ${userId}:`, err.message);
      }
    });

    // ── Admin Monitor Subscription ─────────────────────────────────────────────
    socket.on("monitor_subscribe", () => {
      if (userRole !== "ADMIN") {
        socket.emit("error", { message: "Access denied. Admin role required." });
        return;
      }
      console.log(`[WS] Admin socket ${socket.id} subscribed to live updates.`);
      
      // Send initial overview of navigation sessions
      import("../controllers/navigationEngine.js")
        .then(({ navigationSessions }) => {
          const sessions = [];
          navigationSessions.forEach((sess, uid) => {
            sessions.push({ userId: uid, state: sess.state, travelMode: sess.travelMode });
          });
          socket.emit("monitor_init", { activeSessionsCount: sessions.length, sessions });
        })
        .catch(err => console.error("[WS] Failed to read active sessions:", err.message));
    });

    // ── Inbound message handling ──────────────────────────────────────────────
    socket.on("ping_test", (data, callback) => {
      if (typeof callback === "function") {
        callback({ userId, ts: Date.now() });
      }
    });

    // Forward platform event triggers from trusted clients (dev/testing)
    socket.on("trigger_event", (msg) => {
      if (msg && msg.eventType && msg.payload) {
        import("../services/assistantEngine.js")
          .then(({ AssistantEngine }) => {
            const engine = new AssistantEngine();
            engine
              .processSystemEvent(userId, msg.eventType, msg.payload)
              .catch((e) =>
                console.error("[WS] AssistantEngine processing error:", e.message)
              );
          })
          .catch((err) => {
            console.error("[WS] Failed to load AssistantEngine:", err.message);
          });
      }
    });

    // ── Disconnection handler ─────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      // Only remove if this socket is still the authoritative one for the user
      if (activeConnections.get(userId) === socket.id) {
        activeConnections.delete(userId);
      }
      if (userRole === "ADMIN") {
        adminConnections.delete(socket.id);
      }
      console.log(
        `[WS] User disconnected: ${userId} | reason=${reason} | active=${activeConnections.size}`
      );
    });

    socket.on("error", (err) => {
      console.error(`[WS] Socket error for user ${userId}:`, err.message);
      if (activeConnections.get(userId) === socket.id) {
        activeConnections.delete(userId);
      }
      if (userRole === "ADMIN") {
        adminConnections.delete(socket.id);
      }
    });
  });

  return io;
}

/**
 * Push an assistant alert/message to exactly one authenticated user.
 *
 * @param {string} userId - User UUID
 * @param {object} payload - Message payload containing type, message, actionRequired etc.
 * @returns {boolean} - true if the socket was found and message was emitted
 */
export function emitAssistantMessage(userId, payload) {
  if (!io) {
    console.error("[WS] Socket.io server has not been initialized yet.");
    return false;
  }

  const socketId = activeConnections.get(userId);
  if (!socketId) {
    return false;
  }

  io.to(socketId).emit("assistant_message", payload);
  return true;
}

/**
 * Return the number of active authenticated connections.
 * Useful for health dashboards and debug logging.
 *
 * @returns {number}
 */
export function getConnectionCount() {
  return activeConnections.size;
}

/**
 * Broadcast payload to all active admin socket connections.
 * @param {object} payload
 */
export function broadcastToAdmins(payload) {
  if (!io) return;
  adminConnections.forEach((adminSocket) => {
    adminSocket.emit("monitor_update", payload);
  });
}
