import { AppDataSource } from "../config/db.js";
import { RouteGovernance } from "../entities/RouteGovernance.js";

// GET /api/admin/governance
export const getGovernanceZones = async (req, res) => {
  try {
    const govRepo = AppDataSource.getRepository(RouteGovernance);
    const zones = await govRepo.find({ order: { createdAt: "DESC" } });
    return res.json({ zones });
  } catch (error) {
    console.error("getGovernanceZones error:", error);
    return res.status(500).json({ message: "Failed to fetch route governance zones" });
  }
};

// POST /api/admin/governance
export const addGovernanceZone = async (req, res) => {
  try {
    const { name, type, geoJsonData, isActive } = req.body;
    
    if (!name || !type || !geoJsonData) {
      return res.status(400).json({ message: "Name, type, and geoJsonData are required." });
    }

    // Try to parse the geoJsonData to ensure it is valid JSON
    try {
      JSON.parse(geoJsonData);
    } catch (e) {
      return res.status(400).json({ message: "geoJsonData must be a valid JSON string." });
    }

    const govRepo = AppDataSource.getRepository(RouteGovernance);
    const zone = govRepo.create({
      name,
      type,
      geoJsonData,
      isActive: isActive !== undefined ? isActive : true
    });

    const savedZone = await govRepo.save(zone);

    return res.status(201).json({ message: "Governance zone added successfully", zone: savedZone });
  } catch (error) {
    console.error("addGovernanceZone error:", error);
    return res.status(500).json({ message: "Failed to add governance zone" });
  }
};

// PUT /api/admin/governance/:id/status
export const toggleGovernanceZoneStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const govRepo = AppDataSource.getRepository(RouteGovernance);
    const zone = await govRepo.findOne({ where: { id } });

    if (!zone) {
      return res.status(404).json({ message: "Zone not found" });
    }

    zone.isActive = isActive;
    await govRepo.save(zone);

    return res.json({ message: "Governance zone status updated", zone });
  } catch (error) {
    console.error("toggleGovernanceZoneStatus error:", error);
    return res.status(500).json({ message: "Failed to update governance zone status" });
  }
};

// DELETE /api/admin/governance/:id
export const deleteGovernanceZone = async (req, res) => {
  try {
    const { id } = req.params;
    const govRepo = AppDataSource.getRepository(RouteGovernance);
    const result = await govRepo.delete({ id });

    if (result.affected === 0) {
      return res.status(404).json({ message: "Zone not found" });
    }

    return res.json({ message: "Governance zone deleted successfully" });
  } catch (error) {
    console.error("deleteGovernanceZone error:", error);
    return res.status(500).json({ message: "Failed to delete governance zone" });
  }
};
