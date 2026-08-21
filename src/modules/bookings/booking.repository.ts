import { Types } from 'mongoose';
import { BookingModel, IBooking } from './booking.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { ACTIVE_ASSIGNMENT_STATUSES } from '../../common/constants/assignmentStates';
import {
  BookingStatus,
  UNASSIGNED_BOOKING_STATUSES,
} from '../../common/constants/bookingStates';
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

  /**
   * Unconditional status write. Prefer `compareAndSetStatus` (via the state
   * machine) for lifecycle changes; this is for side-channel field updates
   * that keep the status where it already is.
   */
  async updateStatus(
    bookingId: Types.ObjectId | string,
    status: BookingStatus,
    extra?: Partial<IBooking>,
    session?: mongoose.ClientSession,
  ): Promise<IBooking | null> {
    return BookingModel.findByIdAndUpdate(
      bookingId,
      { $set: { status, ...extra } },
      { new: true, session, runValidators: true },
    ).exec();
  }

  /** Update fields without touching status. */
  async updateFields(
    bookingId: Types.ObjectId | string,
    fields: Partial<IBooking>,
    session?: mongoose.ClientSession,
  ): Promise<IBooking | null> {
    return BookingModel.findByIdAndUpdate(
      bookingId,
      { $set: fields },
      { new: true, session, runValidators: true },
    ).exec();
  }

  /**
   * Compare-and-set the status: only writes if the booking is still in
   * `fromStatus`. Returns null when someone else already moved it.
   */
  async compareAndSetStatus(
    bookingId: Types.ObjectId | string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
    extra?: Partial<IBooking>,
    session?: mongoose.ClientSession,
  ): Promise<IBooking | null> {
    return BookingModel.findOneAndUpdate(
      { _id: bookingId, status: fromStatus },
      { $set: { status: toStatus, ...extra } },
      { new: true, session, runValidators: true },
    ).exec();
  }

  async incrementOtpAttempts(bookingId: Types.ObjectId | string): Promise<void> {
    await BookingModel.findByIdAndUpdate(bookingId, {
      $inc: { serviceOtpAttempts: 1 },
    }).exec();
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

  /**
   * The open pool: bookings still waiting for a barber.
   *
   * Excludes anything that already has an active assignment, so a booking a
   * barber has taken (or an admin has assigned) disappears from every other
   * barber's pool immediately.
   */
  async findOpenPool(pagination: PaginationQuery) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getSkip(page, limit);

    const claimed = await AssignmentModel.find({
      status: { $in: Array.from(ACTIVE_ASSIGNMENT_STATUSES) },
    })
      .select('bookingId')
      .lean()
      .exec();

    const query = {
      status: { $in: Array.from(UNASSIGNED_BOOKING_STATUSES) },
      _id: { $nin: claimed.map((a) => a.bookingId) },
    };

    const [data, total] = await Promise.all([
      BookingModel.find(query)
        .sort({ scheduledStart: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name email phone')
        .populate('serviceId', 'name price durationMinutes')
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

  /** Status counts across all bookings — powers the admin dashboard tiles. */
  async countByStatus(): Promise<Record<string, number>> {
    const rows = await BookingModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});
  }

  /** Sum of serviceSnapshot.price over completed bookings. */
  async sumCompletedRevenue(): Promise<number> {
    const [row] = await BookingModel.aggregate<{ total: number }>([
      { $match: { status: BookingStatus.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$serviceSnapshot.price' } } },
    ]).exec();

    return row?.total ?? 0;
  }
}

export const bookingRepository = new BookingRepository();
