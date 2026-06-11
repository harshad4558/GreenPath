import { AppDataSource } from "../config/db.js";
import { EVStation } from "../entities/EVStation.js";
import { AssistantEngine } from "../services/assistantEngine.js";
import { navigationSessions } from "./navigationEngine.js";

export const getStations = async (req, res) => {
  try {
    const stationRepository = AppDataSource.getRepository(EVStation);
    const stations = await stationRepository.find({
      order: { name: "ASC" }
    });
    return res.json(stations);
  } catch (error) {
    console.error("Get stations error:", error);
    return res.status(500).json({ message: "Error fetching EV charging stations." });
  }
};

export const updateStationStatus = async (req, res) => {
  try {
    const { id, isAvailable } = req.body;

    if (!id || typeof isAvailable !== "boolean") {
      return res.status(400).json({ message: "Station ID and isAvailable boolean are required." });
    }

    const stationRepository = AppDataSource.getRepository(EVStation);
    const station = await stationRepository.findOne({ where: { id } });

    if (!station) {
      return res.status(404).json({ message: "Charging station not found." });
    }

    station.isAvailable = isAvailable;
    station.lastUpdated = new Date();
    await stationRepository.save(station);

    // ── AI Mobility Assistant: STATION_STATUS_CHANGE fan-out ─────────────
    // Notify every user whose active navigation session passes near the station.
    // Uses a 0.15° (~15 km) bounding box — same tolerance as the frontend.
    const stationLat = Number(station.latitude);
    const stationLng = Number(station.longitude);
    const BOX = 0.15;

    for (const [sessionUserId, session] of navigationSessions) {
      if (!session.geometry || session.geometry.length === 0) continue;

      // Calculate bounding box of the active route geometry
      const lats = session.geometry.map(([lat]) => lat);
      const lngs = session.geometry.map(([, lng]) => lng);
      const minLat = Math.min(...lats) - BOX;
      const maxLat = Math.max(...lats) + BOX;
      const minLng = Math.min(...lngs) - BOX;
      const maxLng = Math.max(...lngs) + BOX;

      if (
        stationLat >= minLat && stationLat <= maxLat &&
        stationLng >= minLng && stationLng <= maxLng
      ) {
        AssistantEngine.stationStatusChange(sessionUserId, {
          stationId: station.id,
          stationName: station.name,
          isAvailable,
          chargerType: station.chargerType,
        }).catch((e) =>
          console.error("[AssistantEngine] STATION_STATUS_CHANGE error:", e.message)
        );
      }
    }

    return res.json({
      message: "Station availability updated successfully.",
      station
    });
  } catch (error) {
    console.error("Update station error:", error);
    return res.status(500).json({ message: "Error updating station status." });
  }
};
