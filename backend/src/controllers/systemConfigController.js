import { AppDataSource } from "../config/db.js";
import { SystemConfig } from "../entities/SystemConfig.js";

// Helper to ensure the singleton config exists
export const getOrInitConfig = async () => {
  const configRepo = AppDataSource.getRepository(SystemConfig);
  let config = await configRepo.findOne({ where: { configKey: "GLOBAL_CONFIG" } });
  
  if (!config) {
    config = configRepo.create({ configKey: "GLOBAL_CONFIG" });
    await configRepo.save(config);
  }
  return config;
};

// GET /api/admin/config
export const getSystemConfig = async (req, res) => {
  try {
    const config = await getOrInitConfig();
    return res.json({ config });
  } catch (error) {
    console.error("getSystemConfig error:", error);
    return res.status(500).json({ message: "Failed to fetch system config" });
  }
};

// PUT /api/admin/config
export const updateSystemConfig = async (req, res) => {
  try {
    const { 
      co2Weight, 
      timeWeight, 
      costWeight, 
      rerouteThresholdMeters, 
      cyclingSafetyThreshold, 
      evRecommendationBias,
      safetyWeight,
      landingPageActive,
      landingPageTitle,
      landingPageSubtitle,
      landingPageBgColor,
      landingPageButtonText
    } = req.body;

    const configRepo = AppDataSource.getRepository(SystemConfig);
    const config = await getOrInitConfig();

    if (co2Weight !== undefined) config.co2Weight = Number(co2Weight);
    if (timeWeight !== undefined) config.timeWeight = Number(timeWeight);
    if (costWeight !== undefined) config.costWeight = Number(costWeight);
    if (rerouteThresholdMeters !== undefined) config.rerouteThresholdMeters = Number(rerouteThresholdMeters);
    if (cyclingSafetyThreshold !== undefined) config.cyclingSafetyThreshold = Number(cyclingSafetyThreshold);
    if (evRecommendationBias !== undefined) config.evRecommendationBias = Number(evRecommendationBias);
    if (safetyWeight !== undefined) config.safetyWeight = Number(safetyWeight);
    if (landingPageActive !== undefined) config.landingPageActive = Boolean(landingPageActive);
    if (landingPageTitle !== undefined) config.landingPageTitle = String(landingPageTitle);
    if (landingPageSubtitle !== undefined) config.landingPageSubtitle = String(landingPageSubtitle);
    if (landingPageBgColor !== undefined) config.landingPageBgColor = String(landingPageBgColor);
    if (landingPageButtonText !== undefined) config.landingPageButtonText = String(landingPageButtonText);

    const savedConfig = await configRepo.save(config);

    // TODO: Broadcast via WebSockets if connected users are online, to force client refetch

    return res.json({ message: "System config updated successfully", config: savedConfig });
  } catch (error) {
    console.error("updateSystemConfig error:", error);
    return res.status(500).json({ message: "Failed to update system config" });
  }
};
