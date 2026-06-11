import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";
import { User } from "./UserAndPreferences.js";
import { Trip } from "./Trip.js";

@Entity("gps_trails")
export class GpsTrail {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", nullable: true })
  tripId!: string | null;

  @Column({ type: "decimal", precision: 10, scale: 6 })
  lat!: number;

  @Column({ type: "decimal", precision: 10, scale: 6 })
  lng!: number;

  @Column({ type: "float", nullable: true })
  speed!: number | null;

  @Column({ type: "float", nullable: true })
  heading!: number | null;

  @CreateDateColumn()
  timestamp!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;
}
