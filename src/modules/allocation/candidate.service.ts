import { Types } from 'mongoose';
import { IBarberProfile } from '../barbers/barberProfile.model';
import { IBooking } from '../bookings/booking.model';
import { BarberServiceModel } from '../barberServices/barberService.model';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { availabilityService } from '../availability/availability.service';
import { env } from '../../config/env';
import { isLocationFresh } from '../../common/utils/timeUtils';
import { BarberStatus } from '../../common/constants/roles';

export interface EligibleCandidate {
  profile: IBarberProfile;
  distanceKm: number;
}

export class CandidateService {
  /**
   * Find all eligible barbers for a given booking
   * Applies all 8 eligibility filters:
   * 1. ACTIVE status
   * 2. Auto allocation enabled
   * 3. Valid + fresh location
   * 4. Within radius
   * 5. Offers the requested service
   * 6. Working at requested time
   * 7. No slot conflict
   * 8. Not in excludedBarbers list
   */
  async findEligibleCandidates(booking: IBooking): Promise<EligibleCandidate[]> {
    const { customerLocation, serviceId, scheduledDate, startTime, serviceSnapshot, excludedBarbers } = booking;
    const [longitude, latitude] = customerLocation.coordinates;

    const radiusKm = env.DEFAULT_ALLOCATION_RADIUS_KM;

    // Step 1+2+3+4: Geo query — filters ACTIVE + autoAlloc + location in radius
    const nearbyCandidates = await barberProfileRepository.findNearby(
      longitude,
      latitude,
      radiusKm,
    );

    if (nearbyCandidates.length === 0) return [];

    const excludedIds = new Set(excludedBarbers.map((id) => id.toString()));

    const eligible: EligibleCandidate[] = [];

    for (const candidate of nearbyCandidates) {
      // Filter 3: Location freshness
      if (!candidate.locationUpdatedAt) continue;
      if (!isLocationFresh(candidate.locationUpdatedAt, env.LOCATION_MAX_AGE_MINUTES)) continue;

      // Filter 8: Not excluded
      if (excludedIds.has(candidate._id.toString())) continue;

      // Filter 5: Offers service
      const offersService = await this.barberOffersService(candidate._id, serviceId as Types.ObjectId);
      if (!offersService) continue;

      // Filter 6+7: Working + available
      const { available } = await availabilityService.isBarberAvailableForSlot(
        candidate,
        scheduledDate,
        startTime,
        serviceSnapshot.durationMinutes,
        booking._id,
      );
      if (!available) continue;

      eligible.push({
        profile: candidate,
        distanceKm: candidate.distanceKm ?? 0,
      });
    }

    return eligible;
  }

  private async barberOffersService(
    barberId: Types.ObjectId,
    serviceId: Types.ObjectId,
  ): Promise<boolean> {
    const bs = await BarberServiceModel.findOne({
      barberId,
      serviceId,
      isActive: true,
    })
      .lean()
      .exec();
    return bs !== null;
  }
}

export const candidateService = new CandidateService();
