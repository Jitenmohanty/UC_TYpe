import { Types } from 'mongoose';
import { BookingModel, IBooking } from './booking.model';
import { BookingStatus } from '../../common/constants/bookingStates';
import { buildPaginatedResult, getSkip } from '../../common/utils/pagination';
import { PaginationQuery } from '../../common/types/global';
import mongoose from 'mongoose';

export class BookingRepository {
  async create(
    data: Partial<IBooking>,
    session?: mongoose.ClientSession,
  ): Promise<IBooking> {
    const [booking] = await BookingModel.create([data], { session });
    if (!booking) throw new Error('Failed to create booking');
    return booking;
  }

  async findById(id: Types.ObjectId | string): Promise<IBooking | null> {
    return BookingModel.findById(id)
      .populate('serviceId', 'name price durationMinutes')
      .populate('customerId', 'name email phone')
      .exec();
  }

  async findByIdLean(id: Types.ObjectId | string): Promise<IBooking | null> {
    return BookingModel.findById(id).lean().exec() as Promise<IBooking | null>;
  }

  async updateStatus(
    bookingId: Types.ObjectId | string,
    status: BookingStatus,
    extra?: Partial<IBooking>,
    session?: mongoose.ClientSession,
  ): Promise<IBooking | null> {
    return BookingModel.findByIdAndUpdate(
      bookingId,
      { $set: { status, ...extra } },
      { new: true, session },
    ).exec();
  }

  async addExcludedBarber(
    bookingId: Types.ObjectId | string,
    barberId: Types.ObjectId,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    await BookingModel.findByIdAndUpdate(
      bookingId,
      { $addToSet: { excludedBarbers: barberId } },
      { session },
    ).exec();
  }

  async incrementAllocationAttempts(
    bookingId: Types.ObjectId | string,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    await BookingModel.findByIdAndUpdate(
      bookingId,
      { $inc: { allocationAttempts: 1 } },
      { session },
    ).exec();
  }

  async incrementOtpAttempts(
    bookingId: Types.ObjectId | string,
  ): Promise<void> {
    await BookingModel.findByIdAndUpdate(
      bookingId,
      { $inc: { serviceOtpAttempts: 1 } },
    ).exec();
  }

  async findByCustomer(
    customerId: Types.ObjectId | string,
    filter: Partial<{ status: BookingStatus }>,
    pagination: PaginationQuery,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getSkip(page, limit);
    const query: Record<string, unknown> = { customerId };
    if (filter.status) {
      query['status'] = filter.status;
    }
    const [data, total] = await Promise.all([
      BookingModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('serviceId', 'name price durationMinutes')
        .exec(),
      BookingModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findByStatus(statuses: BookingStatus[], pagination: PaginationQuery) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getSkip(page, limit);

    const query = { status: { $in: statuses } };
    const [data, total] = await Promise.all([
      BookingModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name email phone')
        .populate('serviceId', 'name price')
        .exec(),
      BookingModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findAll(filter: Record<string, unknown>, pagination: PaginationQuery) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getSkip(page, limit);

    const [data, total] = await Promise.all([
      BookingModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name email phone')
        .populate('serviceId', 'name price durationMinutes')
        .exec(),
      BookingModel.countDocuments(filter).exec(),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }
}

export const bookingRepository = new BookingRepository();
