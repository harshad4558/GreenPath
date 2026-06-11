import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Trip } from "./Trip.js";

@Entity("routes")
export class Route {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  travelMode!: "EV" | "CYCLING" | "TRANSIT";

  @Column({ type: "integer" })
  timeEstimate!: number; // in minutes

  @Column({ type: "decimal", precision: 8, scale: 2 })
  costEstimate!: number;

  @Column({ type: "decimal", precision: 8, scale: 2 })
  co2Emissions!: number;

  @Column({ type: "decimal", precision: 8, scale: 2 })
  overallScore!: number;

  @Column({ type: "text" }) // Can store geojson or route geometry array string
  geometryData!: string;

  @ManyToOne(() => Trip, (trip) => trip.routes, { onDelete: "CASCADE" })
  trip!: Trip;
}
