import { AppDataSource } from "../config/db.js";
import { User, UserPreferences } from "../entities/UserAndPreferences.js";
import { SystemConfig } from "../entities/SystemConfig.js";
import { navigationSessions } from "./navigationEngine.js";

// Utility to ensure preferences exist for a user
async function ensurePreferences(user) {
  if (user.preferences) return user.preferences;
  const prefsRepo = AppDataSource.getRepository(UserPreferences);
  const newPrefs = prefsRepo.create({ user });
  await prefsRepo.save(newPrefs);
  user.preferences = newPrefs;
  return newPrefs;
}

export const getLiveDashboard = async (req, res) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.user.id },
      relations: ["preferences"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await ensurePreferences(user);

    let activeSession = null;
    const session = navigationSessions.get(user.id) || (user.activeSessionId ? navigationSessions.get(user.activeSessionId) : null);

    if (session) {
      activeSession = {
        state: session.state,
        currentStepIndex: session.currentStepIndex,
        mode: session.travelMode,
        origin: session.origin,
        destination: session.destination,
        distanceM: session.distanceM,
        durationS: session.durationS,
        bannerInstruction: session.bannerInstruction,
        distanceToTurn: session.distanceToTurn
      };
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        currentStreak: user.currentStreak,
        totalCo2Saved: Number(user.totalCo2Saved),
        ecoPoints: user.ecoPoints,
      },
      preferences: {
        routingPriority: user.preferences.routingPriority,
        evChargingPreference: user.preferences.evChargingPreference,
        preferCycling: user.preferences.preferCycling,
        avoidUnsafeZones: user.preferences.avoidUnsafeZones,
      },
      activeSession,
    });
  } catch (error) {
    console.error("getLiveDashboard error:", error);
    res.status(500).json({ message: "Failed to load dashboard data." });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const prefsRepo = AppDataSource.getRepository(UserPreferences);

    const user = await userRepository.findOne({
      where: { id: req.user.id },
      relations: ["preferences"],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const prefs = await ensurePreferences(user);

    const { routingPriority, evChargingPreference, preferCycling, avoidUnsafeZones } = req.body;

    if (routingPriority) prefs.routingPriority = routingPriority;
    if (evChargingPreference) prefs.evChargingPreference = evChargingPreference;
    if (typeof preferCycling === "boolean") prefs.preferCycling = preferCycling;
    if (typeof avoidUnsafeZones === "boolean") prefs.avoidUnsafeZones = avoidUnsafeZones;

    await prefsRepo.save(prefs);

    res.status(200).json({ message: "Preferences updated successfully", preferences: prefs });
  } catch (error) {
    console.error("updatePreferences error:", error);
    res.status(500).json({ message: "Failed to update preferences." });
  }
};

export const addEcoPointsLive = async (req, res) => {
  try {
    const { pointsToAdd, co2SavedToAdd } = req.body;
    
    if (!pointsToAdd && !co2SavedToAdd) {
      return res.status(400).json({ message: "Provide pointsToAdd or co2SavedToAdd." });
    }

    const userRepository = AppDataSource.getRepository(User);

    // Using query builder for atomic increment
    await userRepository.createQueryBuilder()
      .update(User)
      .set({
        ecoPoints: () => `ecoPoints + ${Number(pointsToAdd || 0)}`,
        totalCo2Saved: () => `totalCo2Saved + ${Number(co2SavedToAdd || 0)}`
      })
      .where("id = :id", { id: req.user.id })
      .execute();

    const updatedUser = await userRepository.findOne({ where: { id: req.user.id } });

    res.status(200).json({
      message: "Eco metrics updated live.",
      ecoPoints: updatedUser.ecoPoints,
      totalCo2Saved: Number(updatedUser.totalCo2Saved)
    });
  } catch (error) {
    console.error("addEcoPointsLive error:", error);
    res.status(500).json({ message: "Failed to update live metrics." });
  }
};

export const getLandingConfig = async (req, res) => {
  try {
    const configRepo = AppDataSource.getRepository(SystemConfig);
    let config = await configRepo.findOne({ where: { configKey: "GLOBAL_CONFIG" } });
    if (!config) {
      config = configRepo.create({ configKey: "GLOBAL_CONFIG" });
      await configRepo.save(config);
    }
    return res.status(200).json({
      landingPageActive: config.landingPageActive,
      landingPageTitle: config.landingPageTitle,
      landingPageSubtitle: config.landingPageSubtitle,
      landingPageBgColor: config.landingPageBgColor,
      landingPageButtonText: config.landingPageButtonText,
    });
  } catch (error) {
    console.error("getLandingConfig error:", error);
    res.status(500).json({ message: "Failed to load landing page configuration." });
  }
};
