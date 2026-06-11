import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("route_governance")
export class RouteGovernance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", default: "UNSAFE_ZONE" })
  type!: "UNSAFE_ZONE" | "CYCLING_RESTRICTION" | "TRANSIT_RESTRICTION";

  // GeoJSON string representing a Polygon or LineString
  @Column({ type: "text" })
  geoJsonData!: string; 

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
