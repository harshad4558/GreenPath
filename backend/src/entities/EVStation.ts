import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from "typeorm";

@Entity("ev_stations")
export class EVStation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  latitude!: number;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  longitude!: number;

  @Column({ type: "varchar" })
  chargerType!: string; // e.g. Level 2, DC Fast

  @Column({ type: "boolean", default: true })
  isAvailable!: boolean;

  @UpdateDateColumn()
  lastUpdated!: Date;
}
