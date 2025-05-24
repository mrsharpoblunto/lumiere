import type { ILocationService, GeoLocationCoordinates } from "../shared/location-service-type.ts";
import { LATITUDE, LONGITUDE } from "./config.ts";

export class ServerLocationService implements ILocationService {
  getLocation(): GeoLocationCoordinates { 
    return { latitude: LATITUDE, longitude: LONGITUDE };
  }
}
