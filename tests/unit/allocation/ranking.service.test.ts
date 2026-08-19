import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RankingService } from '../../../src/modules/allocation/ranking.service';
import type { EligibleCandidate } from '../../../src/modules/allocation/candidate.service';

// Mock env
vi.mock('../../../src/config/env', () => ({
  env: {
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  },
  getRankingWeights: () => ({
    distance: 0.4,
    availability: 0.2,
    rating: 0.15,
    acceptanceRate: 0.1,
    completionRate: 0.1,
    workload: 0.05,
  }),
}));

function createCandidate(overrides: Partial<{
  distanceKm: number;
  rating: number;
  totalOffered: number;
  totalAccepted: number;
  totalCompletedJobs: number;
}>): EligibleCandidate {
  return {
    distanceKm: overrides.distanceKm ?? 1.0,
    profile: {
      _id: { toString: () => 'mock-id' },
      rating: overrides.rating ?? 4.5,
      totalOffered: overrides.totalOffered ?? 10,
      totalAccepted: overrides.totalAccepted ?? 9,
      totalCompletedJobs: overrides.totalCompletedJobs ?? 8,
    },
  } as unknown as EligibleCandidate;
}

describe('RankingService', () => {
  let rankingService: RankingService;

  beforeEach(() => {
    rankingService = new RankingService();
  });

  describe('rank', () => {
    it('should prefer closer barber over farther barber with same rating', () => {
      const nearBarber = createCandidate({ distanceKm: 1.0, rating: 4.5 });
      const farBarber = createCandidate({ distanceKm: 4.5, rating: 4.5 });

      const ranked = rankingService.rank([farBarber, nearBarber]);

      expect(ranked[0]?.distanceKm).toBe(1.0);
      expect(ranked[1]?.distanceKm).toBe(4.5);
    });

    it('should prefer higher-rated barber at similar distances', () => {
      const lowRated = createCandidate({ distanceKm: 2.0, rating: 3.0 });
      const highRated = createCandidate({ distanceKm: 2.2, rating: 5.0 });

      const ranked = rankingService.rank([lowRated, highRated]);

      // High rated should win despite slightly farther distance
      expect(ranked[0]?.profile.rating).toBe(5.0);
    });

    it('should assign score between 0 and 1', () => {
      const candidate = createCandidate({ distanceKm: 2.5, rating: 4.0 });
      const ranked = rankingService.rank([candidate]);

      expect(ranked[0]?.score).toBeGreaterThan(0);
      expect(ranked[0]?.score).toBeLessThanOrEqual(1);
    });

    it('should handle empty candidate list', () => {
      const ranked = rankingService.rank([]);
      expect(ranked).toHaveLength(0);
    });

    it('should return scoreBreakdown for each candidate', () => {
      const candidate = createCandidate({});
      const ranked = rankingService.rank([candidate]);

      expect(ranked[0]?.scoreBreakdown).toHaveProperty('distance');
      expect(ranked[0]?.scoreBreakdown).toHaveProperty('rating');
      expect(ranked[0]?.scoreBreakdown).toHaveProperty('acceptanceRate');
    });

    it('should exclude barber outside 5km radius with 0 distance score', () => {
      const outsideRadius = createCandidate({ distanceKm: 5.1 });
      const ranked = rankingService.rank([outsideRadius]);
      expect(ranked[0]?.scoreBreakdown.distance).toBeLessThanOrEqual(0);
    });
  });

  describe('selectBest', () => {
    it('should return null for empty list', () => {
      expect(rankingService.selectBest([])).toBeNull();
    });

    it('should return highest scored candidate', () => {
      const candidates = [
        createCandidate({ distanceKm: 1.0, rating: 5.0 }),
        createCandidate({ distanceKm: 4.0, rating: 2.0 }),
      ];
      const ranked = rankingService.rank(candidates);
      const best = rankingService.selectBest(ranked);
      expect(best?.profile.rating).toBe(5.0);
    });
  });
});
