import express from "express";
import { 
  updateLocation, 
  navigationSessions, 
  fetchOSRMRouteForEngine, 
  parseOSRMRoute 
} from "../controllers/navigationEngine.js";
import { getTrafficHeatmap } from "../controllers/trafficEngine.js";
import { getCurrentWeather } from "../controllers/weatherEngine.js";

const router = express.Router();

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

// OSRM Profile mappings
const OSRM_PROFILES = {
  EV: "driving",
  CYCLING: "cycling",
  TRANSIT: "foot",
};

/**
 * Geocode address text to coordinates [lat, lng]
 */
async function geocodeAddress(address) {
  const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: { "User-Agent": "GreenPath-SustainableTransitHub/1.0 (contact@greenpath.local)" },
  });

  if (!response.ok) {
    throw new Error(`Nominatim geocoding failed for "${address}": HTTP ${response.status}`);
  }

  const results = await response.json();
  if (!results || results.length === 0) {
    throw new Error(`Could not geocode address: "${address}". Please be more specific.`);
  }

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  };
}

/**
 * Parses coordinate input [lat, lng] or "lat,lng" string.
 */
function parseCoordInput(input) {
  if (Array.isArray(input) && input.length === 2) {
    const lat = parseFloat(input[0]);
    const lng = parseFloat(input[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }
  }
  if (typeof input === "string") {
    const parts = input.split(",");
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng, displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
      }
    }
  }
  return null;
}

/**
 * POST /api/navigation/start
 * Accepts { origin, destination, travelMode, userId }
 */
router.post("/start", async (req, res) => {
  try {
    const { origin, destination, travelMode = "EV", userId = "anonymous" } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ message: "Origin and destination are required." });
    }

    // 1. Resolve start/end coordinates
    let startCoord = parseCoordInput(origin);
    let endCoord = parseCoordInput(destination);

    try {
      if (!startCoord) startCoord = await geocodeAddress(origin);
      if (!endCoord) endCoord = await geocodeAddress(destination);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    // 2. Fetch OSRM Route
    const profile = OSRM_PROFILES[travelMode] || "driving";
    const startPoint = [startCoord.lat, startCoord.lng];
    const endPoint = [endCoord.lat, endCoord.lng];

    const routeData = await fetchOSRMRouteForEngine(profile, startPoint, endPoint);

    // 3. Parse and calculate emissions
    const parsedSession = parseOSRMRoute(routeData, travelMode, endPoint);

    // 4. Save in-memory session
    const sessionState = {
      ...parsedSession,
      currentStepIndex: 0,
      state: "ROUTE_ACTIVE",
    };
    navigationSessions.set(userId, sessionState);

    return res.json({
      message: "Navigation session started successfully.",
      userId,
      startCoords: startPoint,
      endCoords: endPoint,
      travelMode,
      geometry: sessionState.geometry,
      steps: sessionState.steps,
      distanceM: sessionState.distanceM,
      durationS: sessionState.durationS,
      co2Emissions: sessionState.co2Emissions,
      state: sessionState.state,
    });
  } catch (error) {
    console.error("Start navigation error:", error);
    return res.status(500).json({ message: "Failed to initiate navigation session." });
  }
});

/**
 * POST /api/navigation/update-location
 * Accepts { userId, lat, lng, currentStepIndex }
 */
router.post("/update-location", updateLocation);

/**
 * GET /api/navigation/traffic
 * Returns traffic heatmap data
 */
router.get("/traffic", (req, res) => {
  const { lat, lng } = req.query;
  const l = lat ? parseFloat(lat) : undefined;
  const g = lng ? parseFloat(lng) : undefined;
  const heatmap = getTrafficHeatmap(l, g);
  return res.json(heatmap);
});

/**
 * GET /api/navigation/weather
 * Returns weather data for given coordinates
 */
router.get("/weather", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ message: "lat and lng query parameters are required." });
  }
  try {
    const weather = await getCurrentWeather(parseFloat(lat), parseFloat(lng));
    return res.json(weather);
  } catch (err) {
    console.error("Weather endpoint error:", err.message);
    return res.status(500).json({ message: "Error fetching weather data." });
  }
});

export default router;
