import express from "express";
import { compareTrips, saveTrip, getTrips } from "../controllers/tripController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/compare", authMiddleware, compareTrips);
router.post("/save", authMiddleware, saveTrip);
router.get("/", authMiddleware, getTrips);

export default router;
