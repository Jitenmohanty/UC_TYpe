import { Types } from 'mongoose';
import { barberProfileRepository } from './barberProfile.repository';
import { userRepository } from '../users/user.repository';
import { ServiceModel } from '../services/service.model';
import { BarberServiceModel } from '../barberServices/barberService.model';
import { availabilityService } from '../availability/availability.service';
import { candidateService } from '../allocation/candidate.service';
import { rankingService } from '../allocation/ranking.service';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/errors/AppError';
import { BarberStatus } from '../../common/constants/roles';
import { validateCoordinates, toGeoPoint } from '../../common/utils/distance';
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

  async updateMyProfile(userId: Types.ObjectId, data: Partial<{
    bio: string;
    experienceYears: number;
    serviceRadiusKm: number;
    workingHours: unknown;
  }>) {
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

  async toggleAutoAllocation(userId: Types.ObjectId, enabled: boolean) {
    const profile = await barberProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Barber profile');

    return barberProfileRepository.updateAutoAllocation(profile._id, enabled);
  }

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

    const nearby = await barberProfileRepository.findNearby(
      params.longitude,
      params.latitude,
      radiusKm,
    );

    // If service + time filtering requested, apply availability checks
    if (params.serviceId && params.date && params.startTime) {
      const service = await ServiceModel.findById(params.serviceId).exec();
      if (!service) throw new NotFoundError('Service');

      const filtered = [];
      for (const barber of nearby) {
        const offersService = await BarberServiceModel.exists({
          barberId: barber._id,
          serviceId: params.serviceId,
          isActive: true,
        });
        if (!offersService) continue;

        const { available } = await availabilityService.isBarberAvailableForSlot(
          barber,
          params.date,
          params.startTime,
          service.durationMinutes,
        );
        if (!available) continue;

        filtered.push(barber);
      }

      return rankingService.rank(
        filtered.map((b) => ({ profile: b, distanceKm: b.distanceKm ?? 0 })),
      );
    }

    return nearby;
  }

  async getMyBookings(userId: Types.ObjectId, pagination: PaginationQuery) {
    const profile = await barberProfileRepository.findByUserId(userId);
    const barberIds: (Types.ObjectId | string)[] = [userId];
    if (profile) barberIds.push(profile._id);

    const { AssignmentModel } = await import('../assignments/assignment.model');
    const { AssignmentStatus } = await import('../../common/constants/assignmentStates');

    const limit = pagination.limit ?? 50;
    const assignments = await AssignmentModel.find({
      barberId: { $in: barberIds },
      status: {
        $in: [
          AssignmentStatus.ACCEPTED,
          AssignmentStatus.COMPLETED,
          AssignmentStatus.CANCELLED_BY_BARBER,
          AssignmentStatus.OFFERED,
        ],
      },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'customerId', select: 'name email phone' },
          { path: 'serviceId', select: 'name price durationMinutes' },
        ],
      })
      .exec();

    return assignments;
  }
}

export const barberService = new BarberService();
