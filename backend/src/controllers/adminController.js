import { AppDataSource } from "../config/db.js";
import { User } from "../entities/UserAndPreferences.js";
import { Trip } from "../entities/Trip.js";
import { EVStation } from "../entities/EVStation.js";
import { EcoScore } from "../entities/EcoScore.js";
import { GpsTrail } from "../entities/GpsTrail.js";
import { navigationSessions } from "./navigationEngine.js";

// Create or update EV charging stations
export const updateEVStation = async (req, res) => {
  try {
    const { id, name, latitude, longitude, chargerType, isAvailable } = req.body;

    if (!name || latitude === undefined || longitude === undefined || !chargerType) {
      return res.status(400).json({ message: "Name, coordinates (latitude, longitude), and chargerType are required." });
    }

    const stationRepository = AppDataSource.getRepository(EVStation);
    let station;

    if (id) {
      // Update existing station
      station = await stationRepository.findOne({ where: { id } });
      if (!station) {
        return res.status(404).json({ message: "Station not found." });
      }
      station.name = name;
      station.latitude = Number(latitude);
      station.longitude = Number(longitude);
      station.chargerType = chargerType;
      if (isAvailable !== undefined) {
        station.isAvailable = isAvailable;
      }
    } else {
      // Create new station
      station = stationRepository.create({
        name,
        latitude: Number(latitude),
        longitude: Number(longitude),
        chargerType,
        isAvailable: isAvailable !== undefined ? isAvailable : true
      });
    }

    const savedStation = await stationRepository.save(station);

    return res.json({
      message: id ? "Station updated successfully." : "Station created successfully.",
      station: savedStation
    });
  } catch (error) {
    console.error("Admin EV Station update error:", error);
    return res.status(500).json({ message: "Error updating/creating charging station." });
  }
};

// Admin Analytics Dashboard
export const getAnalytics = async (req, res) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const tripRepository = AppDataSource.getRepository(Trip);
    const ecoScoreRepository = AppDataSource.getRepository(EcoScore);
    const stationRepository = AppDataSource.getRepository(EVStation);

    // 1. Total users
    const totalUsers = await userRepository.count();

    // 2. Total trips
    const totalTrips = await tripRepository.count();

    // 3. Sum of CO2 Saved
    const co2SavedResult = await ecoScoreRepository
      .createQueryBuilder("eco")
      .select("SUM(eco.co2Saved)", "sum")
      .getRawOne();
    
    const totalCO2Saved = parseFloat(co2SavedResult?.sum || 0).toFixed(2);

    // 4. Station stats
    const totalStations = await stationRepository.count();
    const availableStations = await stationRepository.count({ where: { isAvailable: true } });

    // 5. User Leaderboard (top eco scorers)
    const leaderboard = await ecoScoreRepository.find({
      relations: ["user"],
      order: { totalPoints: "DESC" },
      take: 5
    });

    const formattedLeaderboard = leaderboard.map(score => ({
      email: score.user.email,
      totalPoints: score.totalPoints,
      co2Saved: score.co2Saved
    }));

    return res.json({
      analytics: {
        totalUsers,
        totalTrips,
        totalCO2Saved: Number(totalCO2Saved),
        totalStations,
        availableStations
      },
      leaderboard: formattedLeaderboard
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return res.status(500).json({ message: "Error loading admin analytics." });
  }
};

export const getLiveMonitorData = async (req, res) => {
  try {
    const activeSessions = [];
    navigationSessions.forEach((session, userId) => {
      activeSessions.push({
        userId,
        state: session.state,
        travelMode: session.travelMode,
        destinationCoords: session.destinationCoords,
        distanceM: session.distanceM,
        durationS: session.durationS,
        currentStepIndex: session.currentStepIndex,
        geometry: session.geometry,
        trafficLevel: session.trafficLevel || "LOW",
        weatherInfo: session.weatherInfo || { condition: "Clear", temp: 25, severity: "NONE" },
      });
    });
    return res.json({
      activeSessions,
      count: activeSessions.length
    });
  } catch (error) {
    console.error("Error getting live monitor data:", error);
    return res.status(500).json({ message: "Error loading live monitor data." });
  }
};

export const getGpsTrails = async (req, res) => {
  try {
    const { tripId } = req.params;
    if (!tripId) {
      return res.status(400).json({ message: "tripId parameter is required." });
    }
    const gpsTrailRepo = AppDataSource.getRepository(GpsTrail);
    const trails = await gpsTrailRepo.find({
      where: { tripId },
      order: { timestamp: "ASC" }
    });
    return res.json(trails);
  } catch (error) {
    console.error("Error fetching GPS trails:", error);
    return res.status(500).json({ message: "Error loading GPS trails for replay." });
  }
};
