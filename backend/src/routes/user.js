import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getLiveDashboard, updatePreferences, addEcoPointsLive, getLandingConfig } from "../controllers/userProfileController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/dashboard", getLiveDashboard);
router.put("/preferences", updatePreferences);
router.post("/analytics/live", addEcoPointsLive);
router.get("/landing-config", getLandingConfig);

export default router;
