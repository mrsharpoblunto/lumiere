import type {
  ILocationService,
  GeoLocationCoordinates,
} from "../shared/location-service-type.ts";

const TIMEZONE_COORDINATES_BY_OFFSET: Record<number, GeoLocationCoordinates> = {
  [-12]: { longitude: -180, latitude: 25 },
  [-11]: { longitude: -165, latitude: 25 },
  [-10]: { longitude: -150, latitude: 25 },
  [-9]: { longitude: -135, latitude: 25 },
  [-8]: { longitude: -120, latitude: 25 },
  [-7]: { longitude: -105, latitude: 25 },
  [-6]: { longitude: -90, latitude: 25 },
  [-5]: { longitude: -75, latitude: 25 },
  [-4]: { longitude: -60, latitude: 25 },
  [-3]: { longitude: -45, latitude: 25 },
  [-2]: { longitude: -30, latitude: 25 },
  [-1]: { longitude: -15, latitude: 25 },
  [0]: { longitude: 0, latitude: 25 },
  [1]: { longitude: 15, latitude: 25 },
  [2]: { longitude: 30, latitude: 25 },
  [3]: { longitude: 45, latitude: 25 },
  [4]: { longitude: 60, latitude: 25 },
  [5]: { longitude: 75, latitude: 25 },
  [6]: { longitude: 90, latitude: 25 },
  [7]: { longitude: 105, latitude: 25 },
  [8]: { longitude: 120, latitude: 25 },
  [9]: { longitude: 135, latitude: 25 },
  [10]: { longitude: 150, latitude: 25 },
  [11]: { longitude: 165, latitude: 25 },
  [12]: { longitude: 180, latitude: 25 },
} as const;

export class BrowserLocationService implements ILocationService {
  private location: GeoLocationCoordinates;

  constructor() {
    this.location = this.getLocationFromTimezone();
    this.getCurrentPosition()
      .then((position) => {
        console.log(position);
        this.location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      })
      .catch(() => {
        console.log("Geolocation failed, using timezone coordinates instead.");
      });
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
        enableHighAccuracy: false,
      });
    });
  }

  private getLocationFromTimezone(): GeoLocationCoordinates {
    const offsetHours = -new Date().getTimezoneOffset() / 60;
    return (
      TIMEZONE_COORDINATES_BY_OFFSET[offsetHours] ||
      TIMEZONE_COORDINATES_BY_OFFSET[-8]
    );
  }

  getLocation(): GeoLocationCoordinates {
    return this.location;
  }
}
