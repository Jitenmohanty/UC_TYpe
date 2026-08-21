import { Types } from 'mongoose';
import { barberProfileRepository } from './barberProfile.repository';
import { userRepository } from '../users/user.repository';
import { ServiceModel } from '../services/service.model';
import { BarberServiceModel } from '../barberServices/barberService.model';
import { availabilityService } from '../availability/availability.service';
import { assignmentService } from '../assignments/assignment.service';
import { AssignmentSource } from '../assignments/assignment.model';
import { bookingRepository } from '../bookings/booking.repository';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { UserRole } from '../../common/constants/roles';
import { validateCoordinates } from '../../common/utils/distance';
import { env } from '../../config/env';
import type { PaginationQuery } from '../../common/types/global';

export class BarberService {
  async getBarberProfile(barberId: string) {
    const profile = await barberProfileRepository.findById(barberId);
    if (!profile) throw new NotFoundError('Barber');
    const user = await userRepository.findById(profile.userId);
    return { profile, user };
  }

  async getMyProfile(userId: Types.ObjectId) {
    const profile = await barberProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Barber profile');
    return profile;
  }

  async updateMyProfile(
    userId: Types.ObjectId,
    data: Partial<{
      bio: string;
      experienceYears: number;
      serviceRadiusKm: number;
      workingHours: unknown;
    }>,
  ) {
    return barberProfileRepository.updateByUserId(userId, data as never);
  }

  async updateLocation(userId: Types.ObjectId, latitude: number, longitude: number) {
    if (!validateCoordinates(latitude, longitude)) {
      throw new ValidationError('Invalid coordinates');
    }

    const profile = await barberProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Barber profile');

    return barberProfileRepository.updateLocation(profile._id, longitude, latitude);
  }

  /**
   * Toggle whether this barber is offered to customers and assignable by admin.
   * (Field is still named autoAllocationEnabled for schema compatibility.)
   */
  async setAcceptingBookings(userId: Types.ObjectId, enabled: boolean) {
    const profile = await barberProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Barber profile');

    return barberProfileRepository.updateAutoAllocation(profile._id, enabled);
  }

  /**
   * Customer-facing barber search: active, bookable barbers near a point,
   * nearest first. Optionally narrowed to those who offer a given service and
   * are free at a given date/time.
   */
  async getNearbyBarbers(params: {
    latitude: number;
    longitude: number;
    serviceId?: string;
    date?: string;
    startTime?: string;
    radiusKm?: number;
  }) {
    if (!validateCoordinates(params.latitude, params.longitude)) {
      throw new ValidationError('Invalid coordinates');
    }

    const radiusKm = Math.min(params.radiusKm ?? env.DEFAULT_ALLOCATION_RADIUS_KM, 50);

    // $geoNear already returns nearest-first, so no extra ranking pass is needed.
    const nearby = await barberProfileRepository.findNearby(
      params.longitude,
      params.latitude,
      radiusKm,
    );

    if (!params.serviceId || !params.date || !params.startTime) {
      return nearby;
    }

    const service = await ServiceModel.findById(params.serviceId).exec();
    if (!service) throw new NotFoundError('Service');

    const available = [];
    for (const barber of nearby) {
      const offersService = await BarberServiceModel.exists({
        barberId: barber._id,
        serviceId: params.serviceId,
        isActive: true,
      });
      if (!offersService) continue;

      const { available: free } = await availabilityService.isBarberAvailableForSlot(
        barber,
        params.date,
        params.startTime,
        service.durationMinutes,
      );
      if (!free) continue;

      available.push(barber);
    }

    return available;
  }

  /** The open pool of bookings still waiting for a barber. */
  async getOpenBookings(pagination: PaginationQuery) {
    return bookingRepository.findOpenPool(pagination);
  }

  /**
   * Barber takes a booking from the open pool.
   *
   * Goes through the same locked, transactional path as an admin assignment, so
   * two barbers racing for one booking cannot both win.
   */
  async claimBooking(userId: Types.ObjectId, bookingId: string) {
    const profile = await barberProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Barber profile');

    return assignmentService.assignBarber({
      bookingId,
      barberProfileId: profile._id,
      source: AssignmentSource.BARBER_CLAIM,
      actorId: userId,
      actorRole: UserRole.BARBER,
    });
  }

  /** This barber's job history, newest first. */
  async getMyBookings(userId: Types.ObjectId, pagination: PaginationQuery) {
    return assignmentService.getMyAssignments(userId, pagination.limit ?? 50);
  }
}

export const barberService = new BarberService();
