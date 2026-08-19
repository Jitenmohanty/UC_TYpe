import { Types } from 'mongoose';
import { BarberProfileModel, IBarberProfile } from './barberProfile.model';
import { BarberStatus } from '../../common/constants/roles';
import { buildPaginatedResult, getSkip } from '../../common/utils/pagination';
import { PaginationQuery } from '../../common/types/global';
import { kmToMeters } from '../../common/utils/distance';

export class BarberProfileRepository {
  async create(data: Partial<IBarberProfile>): Promise<IBarberProfile> {
    return BarberProfileModel.create(data);
  }

  async findById(id: Types.ObjectId | string): Promise<IBarberProfile | null> {
    return BarberProfileModel.findById(id).exec();
  }

  async findByUserId(userId: Types.ObjectId | string): Promise<IBarberProfile | null> {
    return BarberProfileModel.findOne({ userId }).exec();
  }

  async updateById(
    id: Types.ObjectId | string,
    data: Partial<IBarberProfile>,
  ): Promise<IBarberProfile | null> {
    return BarberProfileModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }

  async updateByUserId(
    userId: Types.ObjectId | string,
    data: Partial<IBarberProfile>,
  ): Promise<IBarberProfile | null> {
    return BarberProfileModel.findOneAndUpdate({ userId }, { $set: data }, { new: true }).exec();
  }

  async updateLocation(
    barberId: Types.ObjectId | string,
    longitude: number,
    latitude: number,
  ): Promise<IBarberProfile | null> {
    return BarberProfileModel.findByIdAndUpdate(
      barberId,
      {
        $set: {
          currentLocation: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          locationUpdatedAt: new Date(),
        },
      },
      { new: true },
    ).exec();
  }

  async updateStatus(
    barberId: Types.ObjectId | string,
    status: BarberStatus,
  ): Promise<IBarberProfile | null> {
    return BarberProfileModel.findByIdAndUpdate(
      barberId,
      { $set: { status } },
      { new: true },
    ).exec();
  }

  async updateAutoAllocation(
    barberId: Types.ObjectId | string,
    enabled: boolean,
  ): Promise<IBarberProfile | null> {
    return BarberProfileModel.findByIdAndUpdate(
      barberId,
      { $set: { autoAllocationEnabled: enabled } },
      { new: true },
    ).exec();
  }

  /**
   * Geospatial query — find barbers within radius of a point
   * Returns results sorted by distance (nearest first)
   */
  async findNearby(
    longitude: number,
    latitude: number,
    radiusKm: number,
    filter: Record<string, unknown> = {},
  ): Promise<(IBarberProfile & { distanceKm?: number })[]> {
    const radiusMeters = kmToMeters(radiusKm);

    return BarberProfileModel.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          distanceField: 'distanceMeters',
          maxDistance: radiusMeters,
          spherical: true,
          query: {
            status: BarberStatus.ACTIVE,
            autoAllocationEnabled: true,
            'currentLocation.type': 'Point',
            ...filter,
          },
        },
      },
      {
        $addFields: {
          distanceKm: { $divide: ['$distanceMeters', 1000] },
        },
      },
    ]).exec() as Promise<(IBarberProfile & { distanceKm?: number })[]>;
  }

  async incrementStats(
    barberId: Types.ObjectId | string,
    field: 'totalOffered' | 'totalAccepted' | 'totalCompletedJobs' | 'totalCancellations',
  ): Promise<void> {
    await BarberProfileModel.findByIdAndUpdate(barberId, {
      $inc: { [field]: 1 },
    }).exec();
  }

  async updateRating(barberId: Types.ObjectId | string, newRating: number, totalReviews: number): Promise<void> {
    await BarberProfileModel.findByIdAndUpdate(barberId, {
      $set: { rating: newRating, totalReviews },
    }).exec();
  }

  async findAll(filter: Record<string, unknown>, pagination: PaginationQuery) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getSkip(page, limit);

    const [data, total] = await Promise.all([
      BarberProfileModel.find(filter).skip(skip).limit(limit).populate('userId', '-passwordHash').exec(),
      BarberProfileModel.countDocuments(filter).exec(),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }
}

export const barberProfileRepository = new BarberProfileRepository();
