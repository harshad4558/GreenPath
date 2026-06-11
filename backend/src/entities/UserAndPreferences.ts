import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { Trip } from "./Trip.js";
import { EcoScore } from "./EcoScore.js";

@Entity("user_preferences")
export class UserPreferences {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // We use inverse mapping. user -> user.preferences
  @OneToOne("User", (user: any) => user.preferences, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: any; // Use any to avoid circular referencing issues if needed, or we can use User below

  @Column({ type: "varchar", default: "BALANCE" })
  routingPriority!: "ECO" | "TIME" | "BALANCE";

  @Column({ type: "varchar", default: "ANY" })
  evChargingPreference!: "FAST" | "CHEAP" | "ANY";

  @Column({ type: "boolean", default: false })
  preferCycling!: boolean;

  @Column({ type: "boolean", default: false })
  avoidUnsafeZones!: boolean;
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true, type: "varchar" })
  email!: string;

  @Column({ type: "varchar" })
  password!: string;

  @Column({
    type: "varchar",
    default: "USER"
  })
  role!: "USER" | "ADMIN";

  @Column({ type: "int", default: 0 })
  currentStreak!: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0.0 })
  totalCo2Saved!: number;

  @Column({ type: "int", default: 0 })
  ecoPoints!: number;

  @Column({ type: "varchar", nullable: true })
  activeSessionId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => Trip, (trip) => trip.user)
  trips!: Trip[];

  @OneToMany(() => EcoScore, (ecoScore) => ecoScore.user)
  ecoScores!: EcoScore[];

  @OneToOne(() => UserPreferences, (prefs) => prefs.user, { cascade: true })
  preferences!: UserPreferences;
}
