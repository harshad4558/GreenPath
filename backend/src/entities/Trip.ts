import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from "typeorm";
import { User } from "./UserAndPreferences.js";
import { Route } from "./Route.js";

@Entity("trips")
export class Trip {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  origin!: string;

  @Column({ type: "varchar" })
  destination!: string;

  @Column({
    type: "varchar",
    default: "EV"
  })
  chosenMode!: "EV" | "CYCLING" | "TRANSIT";

  @Column({ type: "decimal", precision: 8, scale: 2, default: 0.0 })
  co2Emissions!: number;

  @Column({ type: "integer", default: 0 })
  pointsEarned!: number;

  @Column({ type: "varchar", default: "PLANNED" })
  status!: string; // e.g. PLANNED, COMPLETED

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.trips, { onDelete: "CASCADE" })
  user!: User;

  @OneToMany(() => Route, (route) => route.trip)
  routes!: Route[];
}
