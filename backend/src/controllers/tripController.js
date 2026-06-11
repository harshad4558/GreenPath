import { AppDataSource } from "../config/db.js";
import { Trip } from "../entities/Trip.js";
import { Route } from "../entities/Route.js";
import { EVStation } from "../entities/EVStation.js";
import { EcoScore } from "../entities/EcoScore.js";
import { User } from "../entities/UserAndPreferences.js";
import { RouteGovernance } from "../entities/RouteGovernance.js";
import { isPathIntersectingZone } from "../utils/geoUtils.js";
import polyline from "@mapbox/polyline";
import { getCachedRoute, cacheRoute } from "../config/redis.js";
import { getTrafficLevel, applyTrafficPenalty } from "./trafficEngine.js";
import { getCurrentWeather, applyWeatherPenalties } from "./weatherEngine.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Carbon emission factors (kg CO2 per km)
const EMISSION_FACTORS = {
  EV: 0.05,       // EV on average grid (eco-mix)
  CYCLING: 0.0,   // Zero direct emissions
  TRANSIT: 0.07,  // Shared rail/bus baseline
};

// Standard gasoline car baseline (single occupant)
const BASELINE_EMISSION_FACTOR = 0.22; // kg CO2/km
const BASELINE_SPEED_KMH = 50;         // avg city speed

// OSRM public demo router base URLs (profile-specific endpoints)
const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const OSRM_PROFILES = {
  EV: "driving",
  CYCLING: "cycling",
  TRANSIT: "foot",
};

// Nominatim OSM geocoder
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Geocode a text address → { lat, lng } via Nominatim
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Check if value is already a coordinate pair [lat, lng]
// ─────────────────────────────────────────────────────────────────────────────
function parseCoordInput(input) {
  // Support direct [lat, lng] arrays
  if (Array.isArray(input) && input.length === 2) {
    const lat = parseFloat(input[0]);
    const lng = parseFloat(input[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }
  }
  return null; // needs geocoding
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Fetch single OSRM route for a given profile
// Returns { distanceM, durationS, geometry: [[lat, lng], ...] } or null
// ─────────────────────────────────────────────────────────────────────────────
async function fetchOSRMRoute(profile, startLat, startLng, endLat, endLng) {
  // OSRM requires coordinates in [lng,lat] order
  const coordString = `${startLng},${startLat};${endLng},${endLat}`;
  const url = `${OSRM_BASE}/${profile}/${coordString}?overview=full&geometries=polyline`;

  const response = await fetch(url);

  if (!response.ok) {
    console.warn(`OSRM [${profile}] HTTP ${response.status} for route ${coordString}`);
    return null;
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    console.warn(`OSRM [${profile}] returned no routes. Code: ${data.code}`);
    return null;
  }

  const route = data.routes[0];
  const distanceM = route.distance;    // meters
  const durationS = route.duration;    // seconds

  // Decode the encoded polyline — returns [[lat, lng], ...] (Leaflet-compatible)
  const decoded = polyline.decode(route.geometry);

  return {
    distanceM,
    durationS,
    geometry: decoded, // array of [lat, lng]
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Compute cost estimate per mode
// ─────────────────────────────────────────────────────────────────────────────
function computeCost(mode, distanceKm, batteryLevel) {
  switch (mode) {
    case "EV": {
      // EV electricity cost: ~$0.04/km + charging penalty if battery is low
      const chargePenaltyCost = batteryLevel < 25 ? 4.0 : 0.0;
      return Math.round((distanceKm * 0.04 + chargePenaltyCost) * 100) / 100;
    }
    case "CYCLING":
      return 0.0;
    case "TRANSIT":
      // Flat-rate transit fare estimate
      return distanceKm < 10 ? 2.5 : distanceKm < 30 ? 4.0 : 6.5;
    default:
      return 0.0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER: POST /trip/compare
// ─────────────────────────────────────────────────────────────────────────────
export const compareTrips = async (req, res) => {
  try {
    const { origin, destination, userPreferences = {}, batteryLevel = 100 } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ message: "Origin and destination are required." });
    }

    // ── Fetch DB Preferences if Authenticated ────────────────────────────────
    let dbPrefs = null;
    if (req.user?.id) {
      const userRepository = AppDataSource.getRepository(User);
      const userWithPrefs = await userRepository.findOne({
        where: { id: req.user.id },
        relations: ["preferences"],
      });
      if (userWithPrefs?.preferences) dbPrefs = userWithPrefs.preferences;
    }

    // ── Redis Cache Check ────────────────────────────────────────────────────
    const cacheKey = `compare:${String(origin).trim()}:${String(destination).trim()}:${batteryLevel}:${dbPrefs?.routingPriority || 'NONE'}`;
    const cachedResult = await getCachedRoute(cacheKey);
    if (cachedResult) {
      console.log("[Redis Cache] Serving trip comparison from cache.");
      return res.json(cachedResult);
    }

    // ── Fetch Global SystemConfig ────────────────────────────────────────────
    const { getOrInitConfig } = await import("./systemConfigController.js");
    const sysConfig = await getOrInitConfig();

    // Scoring weights: dynamic override from DB if available
    let w1 = typeof userPreferences.co2Weight === "number" ? userPreferences.co2Weight : Number(sysConfig.co2Weight);
    let w2 = typeof userPreferences.timeWeight === "number" ? userPreferences.timeWeight : Number(sysConfig.timeWeight);
    let costW = Number(sysConfig.costWeight);

    if (dbPrefs) {
      if (dbPrefs.routingPriority === "ECO") { w1 = 1.5; w2 = 0.5; }
      else if (dbPrefs.routingPriority === "TIME") { w1 = 0.5; w2 = 1.5; }
      else if (dbPrefs.routingPriority === "BALANCE") { w1 = 1.0; w2 = 1.0; }
    }

    // ── Resolve coordinates ──────────────────────────────────────────────────
    let startCoord = parseCoordInput(origin);
    let endCoord = parseCoordInput(destination);

    try {
      if (!startCoord) startCoord = await geocodeAddress(origin);
      if (!endCoord) endCoord = await geocodeAddress(destination);
    } catch (geocodeErr) {
      return res.status(400).json({ message: geocodeErr.message });
    }

    const { lat: startLat, lng: startLng } = startCoord;
    const { lat: endLat, lng: endLng } = endCoord;

    // ── Fetch Traffic & Weather ──────────────────────────────────────────────
    const trafficLevel = getTrafficLevel(startLat, startLng);
    const weatherInfo = await getCurrentWeather(startLat, startLng);

    // ── Fetch OSRM routes concurrently for all 3 profiles ───────────────────
    const [drivingResult, cyclingResult, footResult] = await Promise.allSettled([
      fetchOSRMRoute("driving", startLat, startLng, endLat, endLng),
      fetchOSRMRoute("cycling", startLat, startLng, endLat, endLng),
      fetchOSRMRoute("foot", startLat, startLng, endLat, endLng),
    ]);

    // Map OSRM results to their modes
    const osrmResultMap = {
      EV: drivingResult.status === "fulfilled" ? drivingResult.value : null,
      CYCLING: cyclingResult.status === "fulfilled" ? cyclingResult.value : null,
      TRANSIT: footResult.status === "fulfilled" ? footResult.value : null,
    };

    // Check if at least one route was returned
    const anyRouteAvailable = Object.values(osrmResultMap).some((r) => r !== null);
    if (!anyRouteAvailable) {
      return res.status(502).json({
        message: "OSRM routing service is temporarily unavailable. Please try again.",
      });
    }

    // Use driving distance as canonical reference, or fall back to next available
    const referenceResult =
      osrmResultMap.EV || osrmResultMap.CYCLING || osrmResultMap.TRANSIT;
    const distanceKm = referenceResult.distanceM / 1000;

    // ── Baseline (gasoline car) ──────────────────────────────────────────────
    const baselineCo2 = distanceKm * BASELINE_EMISSION_FACTOR;
    const baselineTimeMinutes = (distanceKm / BASELINE_SPEED_KMH) * 60;

    // ── Build mode options ───────────────────────────────────────────────────
    const comparedModes = {};

    for (const [mode, osrmData] of Object.entries(osrmResultMap)) {
      let modeDistanceKm = distanceKm;
      let timeMinutes;
      let geometry;

      if (osrmData) {
        modeDistanceKm = osrmData.distanceM / 1000;
        timeMinutes = Math.round(osrmData.durationS / 60);
        geometry = osrmData.geometry; // [[lat, lng], ...]
      } else {
        // Graceful degradation: estimate based on driving distance
        timeMinutes = mode === "CYCLING"
          ? Math.round((modeDistanceKm / 15) * 60)   // ~15 km/h cycling avg
          : Math.round((modeDistanceKm / 25) * 60);  // ~25 km/h transit avg
        geometry = [];
      }

      // Apply traffic penalty to road vehicles (EV and Transit)
      if (mode === "EV" || mode === "TRANSIT") {
        timeMinutes = Math.round(applyTrafficPenalty(timeMinutes, trafficLevel));
      }

      const co2Kg = Math.round(modeDistanceKm * EMISSION_FACTORS[mode] * 100) / 100;
      const co2Saving = baselineCo2 - co2Kg;
      const timeDifferenceHours = (timeMinutes - baselineTimeMinutes) / 60;
      const costUsd = computeCost(mode, modeDistanceKm, batteryLevel);

      // EV battery charge penalty: +20 min if battery below 25%
      const chargeTimePenalty = mode === "EV" && batteryLevel < 25 ? 20 : 0;
      const adjustedTime = timeMinutes + chargeTimePenalty;

      // Score = (CO2 Saving × w1) - (Time Penalty × w2)
      let score = (co2Saving * w1) - (timeDifferenceHours * w2);

      // Apply weather penalty to score
      const weatherPenalty = applyWeatherPenalties(mode, weatherInfo);
      score -= weatherPenalty;

      // ── Spatial Route Governance & Safety Scoring ─────────────────────────
      let safetyScore = 100;
      const governanceAlerts = [];
      const govRepo = AppDataSource.getRepository(RouteGovernance);
      const activeZones = await govRepo.find({ where: { isActive: true } });

      for (const zone of activeZones) {
        let polygon = [];
        try { polygon = JSON.parse(zone.geoJsonData); } catch (e) { continue; }

        if (geometry && geometry.length > 0 && isPathIntersectingZone(geometry, polygon)) {
          if (zone.type === "UNSAFE_ZONE") {
            governanceAlerts.push(`Passes through ${zone.name} (Unsafe Zone)`);
            score -= 15; // heavy penalty
            const weight = Number(sysConfig.safetyWeight ?? 0.3);
            safetyScore -= Math.round(40 * weight);
          } else if (zone.type === "CYCLING_RESTRICTION" && mode === "CYCLING") {
            governanceAlerts.push(`Intersects ${zone.name} (Cycling Restricted)`);
            score -= 50; // massive penalty for cycling
            safetyScore -= 50;
          } else if (zone.type === "TRANSIT_RESTRICTION" && mode === "TRANSIT") {
            governanceAlerts.push(`Intersects ${zone.name} (Transit Restricted)`);
            score -= 50;
            safetyScore -= 50;
          }
        }
      }

      safetyScore = Math.max(0, safetyScore);

      // Admin config bias overrides
      if (mode === "CYCLING" && dbPrefs?.preferCycling) {
        score += 20;
      }
      if (mode === "EV" && sysConfig.evRecommendationBias) {
        score += Number(sysConfig.evRecommendationBias) * 10;
      }

      comparedModes[mode] = {
        timeMinutes: adjustedTime,
        co2Kg,
        costUsd,
        geometry,
        governanceAlerts,
        co2SavingKg: Math.max(0, Math.round(co2Saving * 100) / 100),
        timeDifferenceMinutes: Math.round(timeMinutes - baselineTimeMinutes),
        score: Math.round(score * 100) / 100,
        pointsEstimate: Math.max(5, Math.round(co2Saving * 10)),
        distanceKm: Math.round(modeDistanceKm * 100) / 100,
        safetyScore,
      };
    }

    // ── Fetch nearby EV stations from DB (bounding box) ─────────────────────
    const evStationRepository = AppDataSource.getRepository(EVStation);
    const allStations = await evStationRepository.find();

    const pad = 0.15;
    const minLat = Math.min(startLat, endLat) - pad;
    const maxLat = Math.max(startLat, endLat) + pad;
    const minLng = Math.min(startLng, endLng) - pad;
    const maxLng = Math.max(startLng, endLng) + pad;

    const nearbyStations = allStations.filter((station) => {
      const lat = Number(station.latitude);
      const lng = Number(station.longitude);
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    });

    const responseData = {
      origin: startCoord.displayName || String(origin),
      destination: endCoord.displayName || String(destination),
      distanceKm: Math.round(distanceKm * 100) / 100,
      startCoords: [startLat, startLng],
      endCoords: [endLat, endLng],
      nearbyStations,
      options: comparedModes,
      trafficLevel,
      weatherInfo,
    };

    // Cache final response in Redis for 10 minutes
    await cacheRoute(cacheKey, responseData, 600);

    return res.json(responseData);
  } catch (error) {
    console.error("Trip compare error:", error);
    return res.status(500).json({ message: "Error running trip comparison." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER: POST /trip/save
// ─────────────────────────────────────────────────────────────────────────────
export const saveTrip = async (req, res) => {
  try {
    const {
      origin,
      destination,
      chosenMode,
      co2Emissions,
      pointsEarned,
      timeEstimate,
      costEstimate,
      geometryData,
      distanceKm,
    } = req.body;

    if (!origin || !destination || !chosenMode) {
      return res.status(400).json({ message: "Origin, destination, and chosenMode are required." });
    }

    const userRepository = AppDataSource.getRepository(User);
    const tripRepository = AppDataSource.getRepository(Trip);
    const routeRepository = AppDataSource.getRepository(Route);
    const ecoScoreRepository = AppDataSource.getRepository(EcoScore);

    const user = await userRepository.findOne({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 1. Create and persist the Trip record
    const newTrip = tripRepository.create({
      origin,
      destination,
      chosenMode,
      co2Emissions: Number(co2Emissions),
      pointsEarned: parseInt(pointsEarned) || 0,
      status: "COMPLETED",
      user,
    });

    const savedTrip = await tripRepository.save(newTrip);

    // 2. Create the associated Route record with OSRM geometry
    const serializedGeometry =
      typeof geometryData === "string" ? geometryData : JSON.stringify(geometryData || []);

    const newRoute = routeRepository.create({
      travelMode: chosenMode,
      timeEstimate: parseInt(timeEstimate) || 0,
      costEstimate: Number(costEstimate) || 0.0,
      co2Emissions: Number(co2Emissions),
      overallScore: 0.0,
      geometryData: serializedGeometry,
      trip: savedTrip,
    });

    await routeRepository.save(newRoute);

    // 3. Update or create the user's EcoScore aggregate
    let ecoScore = await ecoScoreRepository.findOne({ where: { user: { id: user.id } } });

    // Use actual trip distance for CO2 baseline (fall back to 20km default)
    const tripDistanceKm = Number(distanceKm) || 20;
    const baselineCo2 = tripDistanceKm * BASELINE_EMISSION_FACTOR;
    const co2Saved = Math.max(0, baselineCo2 - Number(co2Emissions));

    if (!ecoScore) {
      ecoScore = ecoScoreRepository.create({
        user,
        totalPoints: parseInt(pointsEarned) || 0,
        co2Saved: Number(co2Saved.toFixed(2)),
        totalTrips: 1,
      });
    } else {
      ecoScore.totalPoints += parseInt(pointsEarned) || 0;
      ecoScore.co2Saved = Number((Number(ecoScore.co2Saved) + co2Saved).toFixed(2));
      ecoScore.totalTrips += 1;
    }

    await ecoScoreRepository.save(ecoScore);

    return res.status(201).json({
      message: "Trip saved successfully and EcoScore updated.",
      trip: {
        id: savedTrip.id,
        origin: savedTrip.origin,
        destination: savedTrip.destination,
        chosenMode: savedTrip.chosenMode,
        pointsEarned: savedTrip.pointsEarned,
        co2Emissions: savedTrip.co2Emissions,
        createdAt: savedTrip.createdAt,
      },
      ecoScore: {
        totalPoints: ecoScore.totalPoints,
        co2Saved: ecoScore.co2Saved,
        totalTrips: ecoScore.totalTrips,
      },
    });
  } catch (error) {
    console.error("Save trip error:", error);
    return res.status(500).json({ message: "Internal server error saving trip." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER: GET /trip
// ─────────────────────────────────────────────────────────────────────────────
export const getTrips = async (req, res) => {
  try {
    const tripRepository = AppDataSource.getRepository(Trip);
    const trips = await tripRepository.find({
      where: { user: { id: req.user.id } },
      order: { createdAt: "DESC" },
      relations: ["routes"],
    });

    return res.json(trips);
  } catch (error) {
    console.error("Get trips error:", error);
    return res.status(500).json({ message: "Error fetching trips." });
  }
};
