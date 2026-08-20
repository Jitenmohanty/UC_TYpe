import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { AssignmentModel, IAssignment } from './assignment.model';
import { AssignmentStatus, ACTIVE_ASSIGNMENT_STATUSES } from '../../common/constants/assignmentStates';

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

  async findActiveByBookingId(bookingId: Types.ObjectId | string): Promise<IAssignment | null> {
    return AssignmentModel.findOne({
      bookingId,
      status: { $in: Array.from(ACTIVE_ASSIGNMENT_STATUSES) },
    }).exec();
  }

  async findByBookingId(bookingId: Types.ObjectId | string): Promise<IAssignment[]> {
    return AssignmentModel.find({ bookingId }).sort({ createdAt: 1 }).exec();
  }

  async findActiveByBarberId(barberId: Types.ObjectId | string): Promise<IAssignment[]> {
    return AssignmentModel.find({
      barberId,
      status: { $in: Array.from(ACTIVE_ASSIGNMENT_STATUSES) },
    })
      .populate('bookingId')
      .exec();
  }

  async findPendingOrActiveByBarber(barberIds: (Types.ObjectId | string)[]): Promise<IAssignment | null> {
    return AssignmentModel.findOne({
      barberId: { $in: barberIds },
      status: { $in: [AssignmentStatus.OFFERED, AssignmentStatus.ACCEPTED, 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] },
    })
      .populate({
        path: 'bookingId',
        populate: { path: 'customerId', select: 'name email phone' },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    assignmentId: Types.ObjectId | string,
    status: AssignmentStatus,
    extra?: Partial<IAssignment>,
    session?: mongoose.ClientSession,
  ): Promise<IAssignment | null> {
    return AssignmentModel.findByIdAndUpdate(
      assignmentId,
      { $set: { status, ...extra } },
      { new: true, session },
    ).exec();
  }

  /**
   * Cancel all OFFERED assignments for a booking (when another barber accepts
   * or booking is cancelled by customer)
   */
  async cancelOfferedAssignments(
    bookingId: Types.ObjectId | string,
    excludeAssignmentId: Types.ObjectId | string,
    status: AssignmentStatus.CANCELLED_BY_CUSTOMER | AssignmentStatus.EXPIRED,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    await AssignmentModel.updateMany(
      {
        bookingId,
        status: AssignmentStatus.OFFERED,
        _id: { $ne: excludeAssignmentId },
      },
      {
        $set: {
          status,
          cancelledAt: new Date(),
        },
      },
      { session },
    ).exec();
  }

  /**
   * Check if barber has a conflicting assignment for the requested slot
   */
  async hasConflict(
    barberId: Types.ObjectId | string,
    scheduledStart: Date,
    scheduledEnd: Date,
    excludeBookingId?: Types.ObjectId | string,
  ): Promise<boolean> {
    // Find accepted assignments for this barber that overlap with the requested time
    const query: Record<string, unknown> = {
      barberId,
      status: { $in: [AssignmentStatus.ACCEPTED] },
    };

    if (excludeBookingId) {
      query['bookingId'] = { $ne: excludeBookingId };
    }

    // Find bookings where the time overlaps
    const conflictingAssignment = await AssignmentModel.findOne(query)
      .populate({
        path: 'bookingId',
        match: {
          scheduledStart: { $lt: scheduledEnd },
          scheduledEnd: { $gt: scheduledStart },
          status: { $nin: ['CUSTOMER_CANCELLED', 'BARBER_CANCELLED', 'ADMIN_CANCELLED', 'EXPIRED'] },
        },
      })
      .exec();

    return conflictingAssignment !== null && conflictingAssignment.bookingId !== null;
  }

  async findByBarberAndStatus(
    barberId: Types.ObjectId | string,
    statuses: AssignmentStatus[],
    limit = 20,
  ): Promise<IAssignment[]> {
    return AssignmentModel.find({
      barberId,
      status: { $in: statuses },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('bookingId')
      .exec();
  }

  async setExpirationJobId(
    assignmentId: Types.ObjectId | string,
    jobId: string,
  ): Promise<void> {
    await AssignmentModel.findByIdAndUpdate(assignmentId, {
      $set: { expirationJobId: jobId },
    }).exec();
  }
}

export const assignmentRepository = new AssignmentRepository();
