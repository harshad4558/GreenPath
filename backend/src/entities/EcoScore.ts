import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne } from "typeorm";
import { User } from "./UserAndPreferences.js";

@Entity("eco_scores")
export class EcoScore {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "integer", default: 0 })
  totalPoints!: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0.0 })
  co2Saved!: number;

  @Column({ type: "integer", default: 0 })
  totalTrips!: number;

  @UpdateDateColumn()
  lastUpdated!: Date;

  @ManyToOne(() => User, (user) => user.ecoScores, { onDelete: "CASCADE" })
  user!: User;
}
