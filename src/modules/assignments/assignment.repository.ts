import { Types } from 'mongoose';
import mongoose, { PopulateOptions } from 'mongoose';
import { AssignmentModel, IAssignment } from './assignment.model';
import { BookingModel } from '../bookings/booking.model';
import {
  AssignmentStatus,
  ACTIVE_ASSIGNMENT_STATUSES,
  SLOT_BLOCKING_ASSIGNMENT_STATUSES,
} from '../../common/constants/assignmentStates';
import { TERMINAL_BOOKING_STATUSES } from '../../common/constants/bookingStates';

// Not `as const` — that makes the nested array readonly, which PopulateOptions
// (a mutable type) will not accept.
const BOOKING_POPULATE: PopulateOptions = {
  path: 'bookingId',
  populate: [
    { path: 'customerId', select: 'name email phone' },
    { path: 'serviceId', select: 'name price durationMinutes' },
  ],
};

export class AssignmentRepository {
  async create(
    data: Partial<IAssignment>,
    session?: mongoose.ClientSession,
  ): Promise<IAssignment> {
    const [assignment] = await AssignmentModel.create([data], { session });
    if (!assignment) throw new Error('Failed to create assignment');
    return assignment;
  }

  async findById(id: Types.ObjectId | string): Promise<IAssignment | null> {
    return AssignmentModel.findById(id).exec();
  }

  async findByIdPopulated(id: Types.ObjectId | string): Promise<IAssignment | null> {
    return AssignmentModel.findById(id).populate(BOOKING_POPULATE).exec();
  }

  async findActiveByBookingId(
    bookingId: Types.ObjectId | string,
    session?: mongoose.ClientSession,
  ): Promise<IAssignment | null> {
    return AssignmentModel.findOne({
      bookingId,
      status: { $in: Array.from(ACTIVE_ASSIGNMENT_STATUSES) },
    })
      .session(session ?? null)
      .exec();
  }

  async findByBookingId(bookingId: Types.ObjectId | string): Promise<IAssignment[]> {
    return AssignmentModel.find({ bookingId }).sort({ createdAt: 1 }).exec();
  }

  /**
   * The barber's current job — the one assignment their dashboard works on.
   * `barberProfileId` is the BarberProfile `_id`, matching Assignment.barberId.
   */
  async findActiveByBarber(
    barberProfileId: Types.ObjectId | string,
  ): Promise<IAssignment | null> {
    return AssignmentModel.findOne({
      barberId: barberProfileId,
      status: { $in: Array.from(ACTIVE_ASSIGNMENT_STATUSES) },
    })
      .populate(BOOKING_POPULATE)
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByBarber(
    barberProfileId: Types.ObjectId | string,
    statuses: AssignmentStatus[],
    limit = 50,
  ): Promise<IAssignment[]> {
    return AssignmentModel.find({
      barberId: barberProfileId,
      status: { $in: statuses },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate(BOOKING_POPULATE)
      .exec();
  }

  /**
   * Compare-and-set the status: only writes if the row is still in `fromStatus`.
   * Returns null when another request already moved it, so callers can fail the
   * transition instead of clobbering a newer state.
   */
  async compareAndSetStatus(
    assignmentId: Types.ObjectId | string,
    fromStatus: AssignmentStatus,
    toStatus: AssignmentStatus,
    extra?: Partial<IAssignment>,
    session?: mongoose.ClientSession,
  ): Promise<IAssignment | null> {
    return AssignmentModel.findOneAndUpdate(
      { _id: assignmentId, status: fromStatus },
      { $set: { status: toStatus, ...extra } },
      // runValidators keeps the status enum honest — findOneAndUpdate skips
      // schema validation by default, which previously let a bogus status
      // (a cast 'EN_ROUTE') be written straight into the collection.
      { new: true, session, runValidators: true },
    ).exec();
  }

  /**
   * Close out every other OFFERED assignment on a booking once one barber has
   * taken it (or the booking went away).
   */
  async closeOtherOfferedAssignments(
    bookingId: Types.ObjectId | string,
    excludeAssignmentId: Types.ObjectId | string | null,
    status: AssignmentStatus.CANCELLED_BY_CUSTOMER | AssignmentStatus.EXPIRED,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      bookingId,
      status: AssignmentStatus.OFFERED,
    };
    if (excludeAssignmentId) {
      filter['_id'] = { $ne: excludeAssignmentId };
    }

    await AssignmentModel.updateMany(
      filter,
      { $set: { status, cancelledAt: new Date() } },
      { session },
    ).exec();
  }

  /**
   * True if this barber already holds a job overlapping [start, end).
   *
   * Two-step on purpose: collect the barber's slot-blocking assignments, then
   * ask the bookings collection which of those actually overlap. The previous
   * `findOne().populate({ match })` version inspected only one arbitrary
   * assignment, so real conflicts slipped through.
   */
  async hasConflict(
    barberProfileId: Types.ObjectId | string,
    scheduledStart: Date,
    scheduledEnd: Date,
    excludeBookingId?: Types.ObjectId | string,
    session?: mongoose.ClientSession,
  ): Promise<boolean> {
    const assignments = await AssignmentModel.find({
      barberId: barberProfileId,
      status: { $in: Array.from(SLOT_BLOCKING_ASSIGNMENT_STATUSES) },
    })
      .select('bookingId')
      .session(session ?? null)
      .lean()
      .exec();

    const excluded = excludeBookingId?.toString();
    const bookingIds = assignments
      .map((a) => a.bookingId)
      .filter((id) => id.toString() !== excluded);

    if (bookingIds.length === 0) return false;

    const overlapping = await BookingModel.exists({
      _id: { $in: bookingIds },
      status: { $nin: Array.from(TERMINAL_BOOKING_STATUSES) },
      scheduledStart: { $lt: scheduledEnd },
      scheduledEnd: { $gt: scheduledStart },
    }).session(session ?? null);

    return overlapping !== null;
  }
}

export const assignmentRepository = new AssignmentRepository();
