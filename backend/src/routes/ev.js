import express from "express";
import { getStations, updateStationStatus } from "../controllers/evController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getStations);
router.post("/status", authMiddleware, updateStationStatus);

export default router;
