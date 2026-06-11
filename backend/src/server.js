import app from "./app.js";
import { AppDataSource } from "./config/db.js";
import { EVStation } from "./entities/EVStation.js";
import { setupWebSocket } from "./config/websocket.js";

const PORT = process.env.PORT || 5000;

// Seed charging stations if none exist or update seed data
async function seedEVStations() {
  try {
    const stationRepository = AppDataSource.getRepository(EVStation);
    const count = await stationRepository.count();

    // Check if we need to refresh the seeds to include Maharashtra stations
    const hasKolhapur = await stationRepository.findOne({ where: { name: "Kolhapur Railway Station Charger Hub" } });

    if (count === 0 || !hasKolhapur) {
      console.log("Seeding mock EV stations for Seattle and Maharashtra, Kolhapur...");
      // Clear existing to avoid duplicate conflicts
      await stationRepository.clear();

      const mockStations = [
        {
          name: "Seattle Union Station Charger",
          latitude: 47.5992,
          longitude: -122.3299,
          chargerType: "DC Fast Charger",
          isAvailable: true
        },
        {
          name: "Bellevue Square Charging Hub",
          latitude: 47.6162,
          longitude: -122.2040,
          chargerType: "Level 2 Charger",
          isAvailable: true
        },
        {
          name: "Space Needle Charging Point",
          latitude: 47.6205,
          longitude: -122.3493,
          chargerType: "DC Fast Charger",
          isAvailable: false
        },
        {
          name: "Kolhapur Railway Station Charger Hub",
          latitude: 16.7025,
          longitude: 74.2405,
          chargerType: "DC Fast Charger",
          isAvailable: true
        },
        {
          name: "DY Patil College Charging Station",
          latitude: 16.6912,
          longitude: 74.2460,
          chargerType: "Level 2 Charger",
          isAvailable: true
        },
        {
          name: "Shivaji University Campus EcoCharger",
          latitude: 16.6780,
          longitude: 74.2540,
          chargerType: "DC Fast Charger",
          isAvailable: false
        },
        {
          name: "Tarabai Park Charging Hub",
          latitude: 16.7120,
          longitude: 74.2470,
          chargerType: "Level 2 Charger",
          isAvailable: true
        },
        {
          name: "Mahalaxmi Temple Charging Spot",
          latitude: 16.6980,
          longitude: 74.2250,
          chargerType: "DC Fast Charger",
          isAvailable: true
        }
      ];

      for (const stationData of mockStations) {
        const station = stationRepository.create(stationData);
        await stationRepository.save(station);
      }
      console.log("Successfully seeded mock EV stations!");
    }
  } catch (error) {
    console.error("Error seeding EV stations:", error);
  }
}

// Database Connection & Server Initialization
AppDataSource.initialize()
  .then(async () => {
    console.log("Successfully connected to the database via TypeORM.");
    
    // Seed database tables with initial dataset
    await seedEVStations();

    // Start Express listener
    const server = app.listen(PORT, () => {
      console.log(`Server is running in production mode on port ${PORT}`);
    });

    // Attach the Real-Time AI Mobility Assistant WebSocket Gateway
    // Shares the same TCP port as Express — no extra listener required.
    const io = setupWebSocket(server);

    // Graceful Shutdown Handler
    const shutdown = async () => {
      console.log("Shutting down server gracefully...");

      // 1. Close the WebSocket gateway first so clients receive close frames.
      io.close(() => console.log("[WS] Socket.io server closed."));

      server.close(async () => {
        console.log("Express server closed.");
        try {
          await AppDataSource.destroy();
          console.log("Database connection pool destroyed.");
          process.exit(0);
        } catch (dbError) {
          console.error("Error closing database connection:", dbError);
          process.exit(1);
        }
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((error) => {
    console.error("Database connection failed. Unable to start server.", error);
    process.exit(1);
  });
