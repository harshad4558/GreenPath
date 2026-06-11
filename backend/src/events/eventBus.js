import { EventEmitter } from "events";

class EventBus extends EventEmitter {}

const eventBus = new EventBus();

export const EVENTS = {
  GPS_UPDATED: "GPS_UPDATED",
  OFF_ROUTE: "OFF_ROUTE",
  TURN_APPROACHING: "TURN_APPROACHING",
  ROUTE_RECALCULATED: "ROUTE_RECALCULATED",
  DESTINATION_REACHED: "DESTINATION_REACHED",
  TRAFFIC_ALERT: "TRAFFIC_ALERT",
  PREDICTIVE_SUGGESTION: "PREDICTIVE_SUGGESTION",
};

export default eventBus;
