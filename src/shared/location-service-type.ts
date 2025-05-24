export type GeoLocationCoordinates = {
  longitude: number;
  latitude: number;
};

export interface ILocationService {
  getLocation(): GeoLocationCoordinates;
}
