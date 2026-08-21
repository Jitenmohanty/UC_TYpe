import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  kmToMeters,
  metersToKm,
  validateCoordinates,
  toGeoPoint,
  fromGeoPoint,
} from '../../../src/common/utils/distance';

/**
 * Replaces tests/unit/allocation/geospatial.test.ts — same utilities, moved here
 * because the `allocation` module was removed along with the auto-dispatch
 * engine. These helpers are still used by booking creation and barber search.
 */
describe('Distance utilities', () => {
  describe('calculateDistance (Haversine)', () => {
    it('returns 0 for identical coordinates', () => {
      expect(calculateDistance(20.2961, 85.8245, 20.2961, 85.8245)).toBeCloseTo(0, 5);
    });

    it('matches a known real-world distance (Bhubaneswar → Cuttack ≈ 20km)', () => {
      const dist = calculateDistance(20.2961, 85.8245, 20.4625, 85.883);
      expect(dist).toBeGreaterThan(18);
      expect(dist).toBeLessThan(22);
    });

    it('is symmetric — order of the two points does not matter', () => {
      const there = calculateDistance(20.2961, 85.8245, 19.3068, 84.808);
      const back = calculateDistance(19.3068, 84.808, 20.2961, 85.8245);
      expect(there).toBeCloseTo(back, 9);
    });

    it('handles coordinates spanning the equator', () => {
      const dist = calculateDistance(-1, 0, 1, 0);
      // 2 degrees of latitude ≈ 222 km
      expect(dist).toBeGreaterThan(220);
      expect(dist).toBeLessThan(225);
    });

    it('handles coordinates spanning the antimeridian', () => {
      // 179°E to 179°W is 2 degrees apart, not 358
      const dist = calculateDistance(0, 179, 0, -179);
      expect(dist).toBeGreaterThan(220);
      expect(dist).toBeLessThan(225);
    });

    it('never returns a negative distance', () => {
      expect(calculateDistance(51.5, -0.12, -33.86, 151.2)).toBeGreaterThan(0);
    });
  });

  describe('radius containment', () => {
    // Mirrors the seed scenario: barbers at 1.2 / 2.7 / 4.3 km are inside a 5km
    // search radius; one at 7.5 km is outside it.
    const CUSTOMER = { lat: 20.2961, lon: 85.8245 };
    const RADIUS_KM = 5;

    const distanceFromCustomer = (lat: number, lon: number) =>
      calculateDistance(CUSTOMER.lat, CUSTOMER.lon, lat, lon);

    it('a barber ~1.2km north is inside a 5km radius', () => {
      const dist = distanceFromCustomer(20.3069, CUSTOMER.lon);
      expect(dist).toBeLessThan(RADIUS_KM);
      expect(dist).toBeGreaterThan(0.5);
    });

    it('a barber ~4.3km away is still inside a 5km radius', () => {
      const dist = distanceFromCustomer(20.3348, CUSTOMER.lon);
      expect(dist).toBeLessThan(RADIUS_KM);
      expect(dist).toBeGreaterThan(4);
    });

    it('a barber ~7.5km away falls outside a 5km radius', () => {
      const dist = distanceFromCustomer(20.3636, CUSTOMER.lon);
      expect(dist).toBeGreaterThan(RADIUS_KM);
    });

    it('agrees with the metre-based bound used by the $geoNear query', () => {
      const dist = distanceFromCustomer(20.3069, CUSTOMER.lon);
      expect(kmToMeters(dist)).toBeLessThan(kmToMeters(RADIUS_KM));
    });
  });

  describe('unit conversion', () => {
    it('converts km to meters', () => {
      expect(kmToMeters(5)).toBe(5000);
      expect(kmToMeters(0)).toBe(0);
      expect(kmToMeters(0.25)).toBe(250);
    });

    it('converts meters to km', () => {
      expect(metersToKm(5000)).toBe(5);
      expect(metersToKm(250)).toBe(0.25);
    });

    it('round-trips', () => {
      expect(metersToKm(kmToMeters(7.3))).toBeCloseTo(7.3, 9);
    });
  });

  describe('validateCoordinates', () => {
    it('accepts valid coordinates', () => {
      expect(validateCoordinates(20.2961, 85.8245)).toBe(true);
      expect(validateCoordinates(0, 0)).toBe(true);
    });

    it('accepts the exact boundary values', () => {
      expect(validateCoordinates(90, 180)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
    });

    it('rejects out-of-range latitude', () => {
      expect(validateCoordinates(91, 0)).toBe(false);
      expect(validateCoordinates(-91, 0)).toBe(false);
    });

    it('rejects out-of-range longitude', () => {
      expect(validateCoordinates(0, 181)).toBe(false);
      expect(validateCoordinates(0, -181)).toBe(false);
    });
  });

  describe('GeoJSON conversion', () => {
    it('toGeoPoint emits [longitude, latitude] — GeoJSON order, not lat/lng', () => {
      const point = toGeoPoint(20.2961, 85.8245);
      expect(point.type).toBe('Point');
      expect(point.coordinates[0]).toBe(85.8245); // longitude first
      expect(point.coordinates[1]).toBe(20.2961); // latitude second
    });

    it('fromGeoPoint reverses toGeoPoint', () => {
      const original = { latitude: 19.3068, longitude: 84.808 };
      const restored = fromGeoPoint(toGeoPoint(original.latitude, original.longitude));
      expect(restored).toEqual(original);
    });

    it('preserves negative coordinates through a round-trip', () => {
      const restored = fromGeoPoint(toGeoPoint(-33.8688, -151.2093));
      expect(restored.latitude).toBe(-33.8688);
      expect(restored.longitude).toBe(-151.2093);
    });
  });
});
