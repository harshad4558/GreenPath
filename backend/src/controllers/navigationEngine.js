import { haversineDistance, getDistanceToPolyline } from "../utils/geoUtils.js";
import { AssistantEngine } from "../services/assistantEngine.js";
import { AppDataSource } from "../config/db.js";
import { User } from "../entities/UserAndPreferences.js";
import { GpsTrail } from "../entities/GpsTrail.js";
import eventBus, { EVENTS } from "../events/eventBus.js";

// In-memory navigation sessions
// Key: userId (string) -> Value: navigation session object
export const navigationSessions = new Map();

// OSRM Profile mapping
const OSRM_PROFILES = {
  EV: "driving",
  CYCLING: "cycling",
  TRANSIT: "foot",
};

/**
 * Reusable helper to construct and fetch OSRM route.
 * Coordinates are formatted as lng,lat.
 */
export async function fetchOSRMRouteForEngine(profile, startCoords, endCoords) {
  const coordString = `${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}`;
  const url = `http://router.project-osrm.org/route/v1/${profile}/${coordString}?overview=full&geometries=geojson&steps=true`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM HTTP error: ${response.status}`);
  }
  const data = await response.json();
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error(`OSRM error: ${data.code}`);
  }
  return data.routes[0];
}

/**
 * Helper to build human-readable step instructions from OSRM maneuver objects.
 */
export function getStepInstruction(step) {
  const name = step.name ? `onto ${step.name}` : "";
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;

  if (type === "depart") return `Depart towards route ${name}`;
  if (type === "arrive") return `Arrive at destination`;
  if (type === "turn") {
    return `Turn ${modifier || ""} ${name}`;
  }
  return `${type} ${modifier || ""} ${name}`;
}

/**
 * Parse OSRM route response into internal session structure.
 */
export function parseOSRMRoute(route, travelMode, destinationCoords) {
  const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]); // Convert [lng, lat] to [lat, lng]
  
  const steps = [];
  if (route.legs && route.legs[0] && route.legs[0].steps) {
    route.legs[0].steps.forEach((step) => {
      const [stepLng, stepLat] = step.maneuver.location;
      steps.push({
        coordinate: [stepLat, stepLng],
        type: step.maneuver.type,
        modifier: step.maneuver.modifier,
        name: step.name || "Route",
        distance: step.distance,
        instruction: getStepInstruction(step),
      });
    });
  }

  // Calculate dynamic CO2 based on actual track distance in meters
  let co2 = 0.0;
  if (travelMode === "EV") {
    co2 = route.distance * 0.05; // grid charging emissions per meter
  } else if (travelMode === "TRANSIT") {
    co2 = route.distance * 0.07; // transit emissions per meter
  } // CYCLING is 0.0

  return {
    geometry: coordinates,
    steps,
    travelMode,
    destinationCoords,
    distanceM: route.distance,
    durationS: route.duration,
    co2Emissions: co2,
  };
}

/**
 * Core GPS Processing Logic
 * Process GPS coordinates, update session, check deviation, turn alert, etc.
 * Emits EventBus events at state transitions.
 */
export async function processGpsUpdate(userId, lat, lng, speed = 0, heading = 0, clientStepIndex = null) {
  const userLoc = [Number(lat), Number(lng)];

  // 1. Save to GpsTrail DB
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (user) {
      const gpsRepo = AppDataSource.getRepository(GpsTrail);
      const trail = gpsRepo.create({
        user,
        tripId: user.activeSessionId,
        lat: Number(lat),
        lng: Number(lng),
        speed: speed !== null ? Number(speed) : null,
        heading: heading !== null ? Number(heading) : null,
      });
      await gpsRepo.save(trail);
    }
  } catch (err) {
    console.warn("[NavigationEngine] Failed to save GPS trail:", err.message);
  }

  // 2. Emit GPS_UPDATED to EventBus
  eventBus.emit(EVENTS.GPS_UPDATED, { userId, lat, lng, speed, heading });

  let session = navigationSessions.get(userId);
  if (!session) {
    return {
      state: "IDLE",
      bannerInstruction: "No active navigation session. Start a route first.",
      currentStepIndex: 0,
      distanceToTurn: 0,
      routeGeometry: null,
    };
  }

  // 3. Check deviation
  const deviation = getDistanceToPolyline(userLoc, session.geometry);

  // Fetch dynamic SystemConfig
  const { getOrInitConfig } = await import("./systemConfigController.js");
  const sysConfig = await getOrInitConfig();
  const rerouteThreshold = sysConfig.rerouteThresholdMeters || 30;

  if (deviation > rerouteThreshold) {
    session.state = "REROUTING";
    const profile = OSRM_PROFILES[session.travelMode] || "driving";

    try {
      const newRoute = await fetchOSRMRouteForEngine(profile, userLoc, session.destinationCoords);
      const parsed = parseOSRMRoute(newRoute, session.travelMode, session.destinationCoords);

      session.geometry = parsed.geometry;
      session.steps = parsed.steps;
      session.currentStepIndex = 0;
      session.state = "ROUTE_ACTIVE";
      session.distanceM = parsed.distanceM;
      session.durationS = parsed.durationS;
      session.co2Emissions = parsed.co2Emissions;

      // Update traffic/weather
      try {
        const { getTrafficLevel } = await import("./trafficEngine.js");
        session.trafficLevel = getTrafficLevel(lat, lng);
        const { getCurrentWeather } = await import("./weatherEngine.js");
        session.weatherInfo = await getCurrentWeather(lat, lng);
      } catch (err) {
        console.warn("Failed to get traffic/weather in reroute:", err.message);
      }

      navigationSessions.set(userId, session);

      // Emit EventBus events
      eventBus.emit(EVENTS.OFF_ROUTE, {
        userId,
        deviationM: Math.round(deviation),
        userLat: userLoc[0],
        userLng: userLoc[1],
        travelMode: session.travelMode,
      });

      return {
        state: "REROUTING",
        bannerInstruction: "Off route! Recalculating path...",
        currentStepIndex: 0,
        distanceToTurn: 0,
        routeGeometry: session.geometry,
        distanceM: session.distanceM,
        durationS: session.durationS,
        co2Emissions: session.co2Emissions,
        trafficLevel: session.trafficLevel,
        weatherInfo: session.weatherInfo,
      };
    } catch (rerouteErr) {
      console.error("OSRM Rerouting failed:", rerouteErr);
      session.state = "OFF_ROUTE";
      navigationSessions.set(userId, session);
      return {
        state: "OFF_ROUTE",
        bannerInstruction: "Off route! Rerouting failed. Please check your path.",
        currentStepIndex: session.currentStepIndex,
        distanceToTurn: 0,
        routeGeometry: session.geometry,
      };
    }
  }

  let stepIndex = (clientStepIndex !== undefined && clientStepIndex !== null)
    ? Number(clientStepIndex)
    : session.currentStepIndex;

  if (stepIndex >= session.steps.length) {
    session.state = "IDLE";
    navigationSessions.set(userId, session);

    // Clear activeSessionId on user
    try {
      const userRepo = AppDataSource.getRepository(User);
      await userRepo.update(userId, { activeSessionId: null });
    } catch (err) {
      console.warn("Failed to clear user activeSessionId on arrival:", err.message);
    }

    eventBus.emit(EVENTS.DESTINATION_REACHED, { userId });

    return {
      state: "IDLE",
      bannerInstruction: "Arrived at destination!",
      currentStepIndex: stepIndex,
      distanceToTurn: 0,
      routeGeometry: session.geometry,
    };
  }

  session.state = "FOLLOWING_ROUTE";

  const upcomingStep = session.steps[stepIndex];
  const distToManeuver = haversineDistance(userLoc, upcomingStep.coordinate);

  let bannerInstruction = upcomingStep.instruction;

  if (distToManeuver < 10) {
    session.state = "TURN_NOW";
    bannerInstruction = `TURN NOW: ${upcomingStep.instruction}`;
    stepIndex += 1;
    session.currentStepIndex = stepIndex;
  } else if (distToManeuver < 50) {
    session.state = "APPROACHING_TURN";
    const direction = upcomingStep.modifier || upcomingStep.type || "turn";
    bannerInstruction = `In ${Math.round(distToManeuver)}m, prepare to turn ${direction}`;

    eventBus.emit(EVENTS.TURN_APPROACHING, {
      userId,
      distToTurnM: Math.round(distToManeuver),
      instruction: upcomingStep.instruction,
      stepModifier: upcomingStep.modifier,
      travelMode: session.travelMode,
    });
  }

  session.currentStepIndex = stepIndex;

  // Dynamically update traffic level and weather info in the session
  try {
    const { getTrafficLevel } = await import("./trafficEngine.js");
    session.trafficLevel = getTrafficLevel(lat, lng);
    const { getCurrentWeather } = await import("./weatherEngine.js");
    session.weatherInfo = await getCurrentWeather(lat, lng);
  } catch (e) {
    console.warn("Failed to dynamic update traffic/weather in navigation session:", e.message);
  }

  navigationSessions.set(userId, session);

  return {
    state: session.state,
    bannerInstruction,
    currentStepIndex: stepIndex,
    distanceToTurn: Math.round(distToManeuver),
    routeGeometry: session.geometry,
    distanceM: session.distanceM,
    durationS: session.durationS,
    co2Emissions: session.co2Emissions,
    trafficLevel: session.trafficLevel,
    weatherInfo: session.weatherInfo,
  };
}

/**
 * Expose telemetry endpoint POST /api/navigation/update-location
 * accepts { userId, lat, lng, currentStepIndex }
 */
export const updateLocation = async (req, res) => {
  try {
    const { userId = "anonymous", lat, lng, currentStepIndex: clientStepIndex } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "Latitude and longitude are required." });
    }

    const result = await processGpsUpdate(userId, lat, lng, null, null, clientStepIndex);
    return res.json(result);
  } catch (error) {
    console.error("Update location telemetry error:", error);
    return res.status(500).json({ message: "Internal telemetry engine error." });
  }
};
