import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from "typeorm";

@Entity("system_config")
export class SystemConfig {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Enforce a singleton pattern by using a static key or just fetching the first row.
  @Column({ type: "varchar", default: "GLOBAL_CONFIG", unique: true })
  configKey!: string;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0.5 })
  co2Weight!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0.3 })
  timeWeight!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0.2 })
  costWeight!: number;

  @Column({ type: "integer", default: 30 })
  rerouteThresholdMeters!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 1.2 })
  cyclingSafetyThreshold!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 1.5 })
  evRecommendationBias!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0.3 })
  safetyWeight!: number;

  @Column({ type: "boolean", default: true })
  landingPageActive!: boolean;

  @Column({ type: "varchar", default: "Empower Your Journey With GreenPath" })
  landingPageTitle!: string;

  @Column({ type: "text", default: "Compare carbon footprints across transportation modes, plan energy-efficient trips, and log eco-friendly miles to earn impact points." })
  landingPageSubtitle!: string;

  @Column({ type: "varchar", default: "Emerald Glow" })
  landingPageBgColor!: string;

  @Column({ type: "varchar", default: "Enter Hub" })
  landingPageButtonText!: string;

  @UpdateDateColumn()
  lastUpdated!: Date;
}
