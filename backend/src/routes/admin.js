import express from "express";
import { updateEVStation, getAnalytics, getLiveMonitorData, getGpsTrails } from "../controllers/adminController.js";
import { getSystemConfig, updateSystemConfig } from "../controllers/systemConfigController.js";
import { getGovernanceZones, addGovernanceZone, toggleGovernanceZoneStatus, deleteGovernanceZone } from "../controllers/routeGovernanceController.js";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/ev/update", authMiddleware, adminMiddleware, updateEVStation);
router.get("/analytics", authMiddleware, adminMiddleware, getAnalytics);

// System Config Routes
router.get("/config", authMiddleware, adminMiddleware, getSystemConfig);
router.put("/config", authMiddleware, adminMiddleware, updateSystemConfig);

// Route Governance Routes
router.get("/governance", authMiddleware, adminMiddleware, getGovernanceZones);
router.post("/governance", authMiddleware, adminMiddleware, addGovernanceZone);
router.put("/governance/:id/status", authMiddleware, adminMiddleware, toggleGovernanceZoneStatus);
router.delete("/governance/:id", authMiddleware, adminMiddleware, deleteGovernanceZone);

// Live Monitoring & Replay GPS Routes
router.get("/live-monitor", authMiddleware, adminMiddleware, getLiveMonitorData);
router.get("/gps-trails/:tripId", authMiddleware, adminMiddleware, getGpsTrails);

export default router;
