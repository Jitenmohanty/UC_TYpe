import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  isTimeInRange,
  buildScheduledDateTime,
  addMinutes,
  doRangesOverlap,
  isLocationFresh,
} from '../../../src/common/utils/timeUtils';

describe('Time Utilities', () => {
  describe('timeToMinutes', () => {
    it('should convert 09:00 to 540', () => {
      expect(timeToMinutes('09:00')).toBe(540);
    });

    it('should convert 17:30 to 1050', () => {
      expect(timeToMinutes('17:30')).toBe(1050);
    });
  });

  describe('isTimeInRange', () => {
    it('17:00 should be in range 09:00–19:00', () => {
      expect(isTimeInRange('17:00', '09:00', '19:00')).toBe(true);
    });

    it('08:59 should NOT be in range 09:00–19:00', () => {
      expect(isTimeInRange('08:59', '09:00', '19:00')).toBe(false);
    });

    it('19:00 should NOT be in range 09:00–19:00 (exclusive end)', () => {
      expect(isTimeInRange('19:00', '09:00', '19:00')).toBe(false);
    });
  });

  describe('doRangesOverlap', () => {
    it('should detect overlapping ranges', () => {
      const start1 = new Date('2026-08-25T09:00:00Z');
      const end1 = new Date('2026-08-25T10:00:00Z');
      const start2 = new Date('2026-08-25T09:30:00Z');
      const end2 = new Date('2026-08-25T10:30:00Z');
      expect(doRangesOverlap(start1, end1, start2, end2)).toBe(true);
    });

    it('should NOT detect overlap for adjacent ranges', () => {
      const start1 = new Date('2026-08-25T09:00:00Z');
      const end1 = new Date('2026-08-25T10:00:00Z');
      const start2 = new Date('2026-08-25T10:00:00Z');
      const end2 = new Date('2026-08-25T11:00:00Z');
      expect(doRangesOverlap(start1, end1, start2, end2)).toBe(false);
    });

    it('should detect fully contained range as overlap', () => {
      const start1 = new Date('2026-08-25T09:00:00Z');
      const end1 = new Date('2026-08-25T11:00:00Z');
      const start2 = new Date('2026-08-25T09:30:00Z');
      const end2 = new Date('2026-08-25T10:30:00Z');
      expect(doRangesOverlap(start1, end1, start2, end2)).toBe(true);
    });
  });

  describe('isLocationFresh', () => {
    it('should return true for location updated 5 minutes ago with 30 min max', () => {
      const updatedAt = new Date(Date.now() - 5 * 60 * 1000);
      expect(isLocationFresh(updatedAt, 30)).toBe(true);
    });

    it('should return false for location updated 45 minutes ago with 30 min max', () => {
      const updatedAt = new Date(Date.now() - 45 * 60 * 1000);
      expect(isLocationFresh(updatedAt, 30)).toBe(false);
    });

    it('should return false for location never updated (old date)', () => {
      const updatedAt = new Date('2020-01-01');
      expect(isLocationFresh(updatedAt, 30)).toBe(false);
    });
  });

  describe('addMinutes', () => {
    it('should add 45 minutes to a date', () => {
      const start = new Date('2026-08-25T17:00:00Z');
      const end = addMinutes(start, 45);
      expect(end.toISOString()).toBe('2026-08-25T17:45:00.000Z');
    });
  });
});
