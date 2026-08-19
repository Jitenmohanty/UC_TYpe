import { EligibleCandidate } from './candidate.service';
import { getRankingWeights } from '../../config/env';

export interface RankedCandidate extends EligibleCandidate {
  score: number;
  scoreBreakdown: {
    distance: number;
    availability: number;
    rating: number;
    acceptanceRate: number;
    completionRate: number;
    workload: number;
  };
}

const MAX_DISTANCE_KM = 5;
const MAX_WORKLOAD = 10;

export class RankingService {
  /**
   * Score and rank eligible barber candidates
   *
   * Formula:
   * score = distanceScore * 0.40
   *       + availabilityScore * 0.20
   *       + ratingScore * 0.15
   *       + acceptanceRateScore * 0.10
   *       + completionRateScore * 0.10
   *       + workloadScore * 0.05
   */
  rank(candidates: EligibleCandidate[]): RankedCandidate[] {
    const weights = getRankingWeights();

    const scored: RankedCandidate[] = candidates.map((candidate) => {
      const { profile, distanceKm } = candidate;

      // Distance score: closer = higher score (inverted, normalized 0–1)
      const distanceScore = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);

      // Availability score: placeholder for future slot-exactness scoring
      // Currently 1.0 since all candidates passed availability check
      const availabilityScore = 1.0;

      // Rating score: normalized 0–1 (max rating = 5)
      const ratingScore = profile.rating / 5;

      // Acceptance rate (0–100 → 0–1)
      const acceptanceRateRaw =
        profile.totalOffered > 0
          ? profile.totalAccepted / profile.totalOffered
          : 0.5; // neutral default for new barbers
      const acceptanceRateScore = Math.min(1, acceptanceRateRaw);

      // Completion rate
      const completionRateRaw =
        profile.totalAccepted > 0
          ? profile.totalCompletedJobs / profile.totalAccepted
          : 0.5;
      const completionRateScore = Math.min(1, completionRateRaw);

      // Workload score: fewer active bookings = higher score
      const currentWorkload = 0; // TODO: query active booking count per barber
      const workloadScore = Math.max(0, 1 - currentWorkload / MAX_WORKLOAD);

      const score =
        distanceScore * weights.distance +
        availabilityScore * weights.availability +
        ratingScore * weights.rating +
        acceptanceRateScore * weights.acceptanceRate +
        completionRateScore * weights.completionRate +
        workloadScore * weights.workload;

      return {
        ...candidate,
        score: parseFloat(score.toFixed(4)),
        scoreBreakdown: {
          distance: distanceScore,
          availability: availabilityScore,
          rating: ratingScore,
          acceptanceRate: acceptanceRateScore,
          completionRate: completionRateScore,
          workload: workloadScore,
        },
      };
    });

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }

  selectBest(ranked: RankedCandidate[]): RankedCandidate | null {
    return ranked[0] ?? null;
  }
}

export const rankingService = new RankingService();
