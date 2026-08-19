import { describe, it, expect, vi } from 'vitest';
import { calculateDistance, validateCoordinates, toGeoPoint, kmToMeters } from '../../../src/common/utils/distance';

describe('Distance Utilities', () => {
  describe('calculateDistance (Haversine)', () => {
    it('should return 0 for same coordinates', () => {
      const dist = calculateDistance(20.2961, 85.8245, 20.2961, 85.8245);
      expect(dist).toBeCloseTo(0, 5);
    });

    it('should return correct distance for known coordinates', () => {
      // Bhubaneswar to Cuttack (~25km apart)
      const dist = calculateDistance(20.2961, 85.8245, 20.4625, 85.8830);
      expect(dist).toBeGreaterThan(18);
      expect(dist).toBeLessThan(22);
    });

    it('should be symmetric (A→B == B→A)', () => {
      const d1 = calculateDistance(20.2961, 85.8245, 20.5, 85.9);
      const d2 = calculateDistance(20.5, 85.9, 20.2961, 85.8245);
      expect(d1).toBeCloseTo(d2, 5);
    });

    it('barber at 1.2km should be within 5km radius', () => {
      const customerLat = 20.2961;
      const customerLon = 85.8245;
      // Approx 1.2km away
      const barberLat = 20.3069;
      const barberLon = 85.8245;
      const dist = calculateDistance(customerLat, customerLon, barberLat, barberLon);
      expect(dist).toBeLessThan(5);
    });

    it('barber at 7.5km should be OUTSIDE 5km radius', () => {
      const customerLat = 20.2961;
      const customerLon = 85.8245;
      // Approx 7.5km away
      const barberLat = 20.3636;
      const barberLon = 85.8245;
      const dist = calculateDistance(customerLat, customerLon, barberLat, barberLon);
      expect(dist).toBeGreaterThan(5);
    });
  });

  describe('validateCoordinates', () => {
    it('should validate valid coordinates', () => {
      expect(validateCoordinates(20.2961, 85.8245)).toBe(true);
    });

    it('should reject latitude > 90', () => {
      expect(validateCoordinates(91, 85)).toBe(false);
    });

    it('should reject longitude > 180', () => {
      expect(validateCoordinates(20, 181)).toBe(false);
    });

    it('should reject latitude < -90', () => {
      expect(validateCoordinates(-91, 0)).toBe(false);
    });

    it('should accept boundary values', () => {
      expect(validateCoordinates(90, 180)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
    });
  });

  describe('toGeoPoint', () => {
    it('should create GeoJSON with [longitude, latitude] order', () => {
      const point = toGeoPoint(20.2961, 85.8245);
      expect(point.type).toBe('Point');
      expect(point.coordinates[0]).toBe(85.8245); // longitude first
      expect(point.coordinates[1]).toBe(20.2961); // latitude second
    });
  });

  describe('kmToMeters', () => {
    it('should convert 5km to 5000m', () => {
      expect(kmToMeters(5)).toBe(5000);
    });
  });
});
