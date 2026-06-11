import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trip.js";
import evRoutes from "./routes/ev.js";
import adminRoutes from "./routes/admin.js";
import navigationRoutes from "./routes/navigation.js";
import userRoutes from "./routes/user.js";
import assistantRoutes from "./routes/assistant.js";

const app = express();

// Global Middleware
app.use(cors({
  origin: "*", // Adjust in production to frontend domain
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/ev", evRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/navigation", navigationRoutes);
app.use("/api/user", userRoutes);
app.use("/api/assistant", assistantRoutes); // Real-Time AI Mobility Assistant Engine

// Base Status Route
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global express error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error.",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

export default app;
