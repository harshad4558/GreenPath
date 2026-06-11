import "reflect-metadata";
import { DataSource } from "typeorm";
import { User, UserPreferences } from "../entities/UserAndPreferences.js";
import { EVStation } from "../entities/EVStation.js";
import { Trip } from "../entities/Trip.js";
import { Route } from "../entities/Route.js";
import { EcoScore } from "../entities/EcoScore.js";
import { SystemConfig } from "../entities/SystemConfig.js";
import { RouteGovernance } from "../entities/RouteGovernance.js";
import { GpsTrail } from "../entities/GpsTrail.js";
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "sustainable_transport_hub",
  synchronize: true, // Automatically creates tables according to entities (ideal for dev/prod matching)
  logging: false,
  entities: [User, UserPreferences, EVStation, Trip, Route, EcoScore, SystemConfig, RouteGovernance, GpsTrail],
  migrations: [],
  subscribers: [],
});
