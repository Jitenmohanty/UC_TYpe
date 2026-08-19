import { DayOfWeek, GeoPoint } from '../types/global';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine formula — returns distance in KM between two coordinates
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function kmToMeters(km: number): number {
  return km * 1000;
}

export function metersToKm(meters: number): number {
  return meters / 1000;
}

export function validateCoordinates(latitude: number, longitude: number): boolean {
  return (
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  );
}

export function toGeoPoint(latitude: number, longitude: number): GeoPoint {
  return {
    type: 'Point',
    coordinates: [longitude, latitude], // GeoJSON: [lng, lat]
  };
}

export function fromGeoPoint(point: GeoPoint): { latitude: number; longitude: number } {
  return {
    longitude: point.coordinates[0],
    latitude: point.coordinates[1],
  };
}
