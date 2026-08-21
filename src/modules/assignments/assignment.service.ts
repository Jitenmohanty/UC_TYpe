import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { assignmentRepository } from './assignment.repository';
import { AssignmentSource, IAssignment } from './assignment.model';
import { assignmentStateMachine } from './assignment.stateMachine';
import { bookingRepository } from '../bookings/booking.repository';
import { bookingStateMachine } from '../bookings/booking.stateMachine';
import { IBooking } from '../bookings/booking.model';
import { serviceOtpService } from '../bookings/serviceOtp.service';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { notificationService } from '../notifications/notification.service';
import { auditService } from '../../audit/audit.service';
import { lockService } from '../../common/services/lock.service';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../common/errors/AppError';
import { AssignmentStatus } from '../../common/constants/assignmentStates';
import {
  BookingStatus,
  TERMINAL_BOOKING_STATUSES,
  UNASSIGNED_BOOKING_STATUSES,
} from '../../common/constants/bookingStates';
import { UserRole } from '../../common/constants/roles';
import { logger } from '../../common/utils/logger';

export interface AssignBarberInput {
  bookingId: string;
  /** BarberProfile._id of the barber taking the job. */
  barberProfileId: Types.ObjectId | string;
  source: AssignmentSource;
  /** User._id of the actor, for the audit trail. */
  actorId: Types.ObjectId;
  actorRole: UserRole;
}

export class AssignmentService {
  // ─── Identity helpers ───────────────────────────────────────────────────────

  /**
   * Map an authenticated barber's User._id to their BarberProfile._id.
   *
   * Every assignment/lock/stat lookup keys off the *profile* id. Passing the
   * User id instead was the root of several silent no-ops (stats never
   * incremented, slot-conflict checks that never matched).
   */
  private async requireBarberProfileId(barberUserId: Types.ObjectId): Promise<Types.ObjectId> {
    const profile = await barberProfileRepository.findByUserId(barberUserId);
    if (!profile) throw new NotFoundError('Barber profile');
    return profile._id;
  }

  private assertOwnsAssignment(
    assignment: IAssignment,
    barberProfileId: Types.ObjectId,
  ): void {
    if (assignment.barberId.toString() !== barberProfileId.toString()) {
      throw new ForbiddenError('This assignment does not belong to you');
    }
  }

  /** Load an assignment and verify the calling barber owns it. */
  private async loadOwnedAssignment(
    assignmentId: string,
    barberUserId: Types.ObjectId,
  ): Promise<{ assignment: IAssignment; barberProfileId: Types.ObjectId; booking: IBooking }> {
    const barberProfileId = await this.requireBarberProfileId(barberUserId);

    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    this.assertOwnsAssignment(assignment, barberProfileId);

    const booking = await bookingRepository.findByIdLean(assignment.bookingId);
    if (!booking) throw new NotFoundError('Booking');

    return { assignment, barberProfileId, booking };
  }

  // ─── Shared assignment path (barber claim + admin assign) ───────────────────

  /**
   * Put a barber onto an unassigned booking and confirm it.
   *
   * Used by both the barber self-claim endpoint and the admin allocation
   * console, so both paths get the same locking, conflict checks, state-machine
   * validation and OTP issuance.
   */
  async assignBarber(input: AssignBarberInput): Promise<IAssignment> {
    const { bookingId, barberProfileId, source, actorId, actorRole } = input;

    const profile = await barberProfileRepository.findById(barberProfileId);
    if (!profile) throw new NotFoundError('Barber');
    if (profile.status !== 'ACTIVE') {
      throw new ConflictError('This barber is not active', 'BARBER_NOT_ACTIVE');
    }

    const lockKey = lockService.bookingAssignmentLockKey(bookingId);

    const outcome = await lockService.withLock(
      lockKey,
      async () => this.assignBarberLocked(bookingId, profile._id, source, actorId),
      15000,
    );

    if (outcome === null) {
      throw new ConflictError(
        'Another request is already assigning this booking — please retry',
        'BOOKING_ASSIGNMENT_IN_PROGRESS',
      );
    }

    const { assignment, booking } = outcome;

    await barberProfileRepository.incrementStats(profile._id, 'totalAccepted');

    // Notify the customer that their booking is confirmed.
    await notificationService.notifyCustomerBookingConfirmed(
      booking.customerId,
      bookingId,
    );

    await auditService.log({
      actorId,
      actorRole,
      action:
        source === AssignmentSource.ADMIN_ASSIGN
          ? 'ADMIN_MANUAL_ASSIGNMENT'
          : 'BARBER_CLAIMED_BOOKING',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { barberId: profile._id.toString(), assignmentId: assignment._id.toString() },
    });

    logger.info({
      msg: 'Barber assigned to booking',
      bookingId,
      barberId: profile._id.toString(),
      source,
    });

    return assignment;
  }

  private async assignBarberLocked(
    bookingId: string,
    barberProfileId: Types.ObjectId,
    source: AssignmentSource,
    assignedBy: Types.ObjectId,
  ): Promise<{ assignment: IAssignment; booking: IBooking }> {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    if (TERMINAL_BOOKING_STATUSES.has(booking.status)) {
      throw new ConflictError(
        `Booking is already ${booking.status}`,
        'BOOKING_NOT_ASSIGNABLE',
      );
    }

    // Already taken by someone else?
    const existing = await assignmentRepository.findActiveByBookingId(booking._id);
    if (existing) {
      if (existing.barberId.toString() === barberProfileId.toString()) {
        throw new ConflictError('You are already assigned to this booking', 'ALREADY_ASSIGNED');
      }
      throw new ConflictError(
        'This booking has already been taken by another barber',
        'BOOKING_ALREADY_CLAIMED',
      );
    }

    if (!UNASSIGNED_BOOKING_STATUSES.has(booking.status)) {
      throw new ConflictError(
        `Booking in ${booking.status} cannot be assigned`,
        'BOOKING_NOT_ASSIGNABLE',
      );
    }

    // Would this double-book the barber?
    const conflict = await assignmentRepository.hasConflict(
      barberProfileId,
      booking.scheduledStart,
      booking.scheduledEnd,
      booking._id,
    );
    if (conflict) {
      throw new ConflictError(
        'This barber already has a job overlapping that time',
        'SLOT_CONFLICT',
      );
    }

    let created: IAssignment | undefined;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        created = await assignmentRepository.create(
          {
            bookingId: booking._id,
            barberId: barberProfileId,
            status: AssignmentStatus.ACCEPTED,
            source,
            assignedBy,
            offeredAt: new Date(),
            acceptedAt: new Date(),
          },
          session,
        );

        await bookingStateMachine.transition(
          booking._id,
          booking.status,
          BookingStatus.CONFIRMED,
          undefined,
          session,
        );

        // Any stale OFFERED rows on this booking are now moot.
        await assignmentRepository.closeOtherOfferedAssignments(
          booking._id,
          created._id,
          AssignmentStatus.EXPIRED,
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    if (!created) throw new Error('Assignment creation failed');

    // Issue the doorstep OTP now that the booking is CONFIRMED.
    const confirmed = await bookingRepository.findByIdLean(booking._id);
    if (confirmed) {
      await serviceOtpService.issue(confirmed);
    }

    return { assignment: created, booking };
  }

  // ─── Barber-facing lifecycle ────────────────────────────────────────────────

  /**
   * Accept an offer the customer directed at this barber specifically.
   * (The open-pool path goes through `assignBarber` instead.)
   */
  async acceptAssignment(assignmentId: string, barberUserId: Types.ObjectId) {
    const { assignment, barberProfileId, booking } = await this.loadOwnedAssignment(
      assignmentId,
      barberUserId,
    );

    if (assignment.status !== AssignmentStatus.OFFERED) {
      throw new ConflictError(
        `Assignment is ${assignment.status} — cannot accept`,
        'ASSIGNMENT_NOT_OFFERED',
      );
    }

    if (TERMINAL_BOOKING_STATUSES.has(booking.status)) {
      throw new ConflictError('Booking is no longer active', 'BOOKING_INACTIVE');
    }

    const slotLockKey = lockService.barberSlotLockKey(
      barberProfileId.toString(),
      booking.scheduledDate,
      booking.startTime,
    );

    const result = await lockService.withLock(
      slotLockKey,
      async () => {
        const conflict = await assignmentRepository.hasConflict(
          barberProfileId,
          booking.scheduledStart,
          booking.scheduledEnd,
          booking._id,
        );
        if (conflict) {
          throw new ConflictError(
            'You have a conflicting booking at this time',
            'SLOT_CONFLICT',
          );
        }

        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await assignmentStateMachine.transition(
              assignment._id,
              AssignmentStatus.OFFERED,
              AssignmentStatus.ACCEPTED,
              undefined,
              session,
            );

            await bookingStateMachine.transition(
              booking._id,
              booking.status,
              BookingStatus.CONFIRMED,
              undefined,
              session,
            );

            await assignmentRepository.closeOtherOfferedAssignments(
              booking._id,
              assignment._id,
              AssignmentStatus.EXPIRED,
              session,
            );
          });
        } finally {
          await session.endSession();
        }
        return true;
      },
      15000,
    );

    if (result === null) {
      throw new ConflictError('Could not acquire slot lock — please retry', 'SLOT_LOCK_FAILED');
    }

    await barberProfileRepository.incrementStats(barberProfileId, 'totalAccepted');

    const confirmed = await bookingRepository.findByIdLean(booking._id);
    if (confirmed) {
      await serviceOtpService.issue(confirmed);
    }

    await notificationService.notifyCustomerBookingConfirmed(
      booking.customerId,
      booking._id.toString(),
    );

    await auditService.log({
      actorId: barberUserId,
      actorRole: UserRole.BARBER,
      action: 'ASSIGNMENT_ACCEPTED',
      entityType: 'Assignment',
      entityId: assignmentId,
    });

    return assignmentRepository.findByIdPopulated(assignmentId);
  }

  async rejectAssignment(assignmentId: string, barberUserId: Types.ObjectId, reason?: string) {
    const { assignment, barberProfileId, booking } = await this.loadOwnedAssignment(
      assignmentId,
      barberUserId,
    );

    if (assignment.status !== AssignmentStatus.OFFERED) {
      throw new ConflictError('Assignment is not in OFFERED state', 'ASSIGNMENT_NOT_OFFERED');
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await assignmentStateMachine.transition(
          assignment._id,
          AssignmentStatus.OFFERED,
          AssignmentStatus.REJECTED,
          { cancellationReason: reason },
          session,
        );

        // Return the booking to the open pool so another barber (or the admin)
        // can pick it up.
        if (booking.status === BookingStatus.OFFERED) {
          await bookingStateMachine.transition(
            booking._id,
            BookingStatus.OFFERED,
            BookingStatus.PENDING,
            { cancellationReason: reason },
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    await barberProfileRepository.incrementStats(barberProfileId, 'totalRejected');

    await auditService.log({
      actorId: barberUserId,
      actorRole: UserRole.BARBER,
      action: 'ASSIGNMENT_REJECTED',
      entityType: 'Assignment',
      entityId: assignmentId,
      metadata: { reason },
    });

    logger.info({ msg: 'Assignment rejected — booking returned to pool', assignmentId, reason });

    return assignmentRepository.findByIdPopulated(assignmentId);
  }

  /** ACCEPTED → EN_ROUTE. */
  async startJourney(assignmentId: string, barberUserId: Types.ObjectId) {
    const { assignment, booking } = await this.loadOwnedAssignment(assignmentId, barberUserId);

    const updated = await assignmentStateMachine.transition(
      assignment._id,
      assignment.status,
      AssignmentStatus.EN_ROUTE,
    );

    await auditService.log({
      actorId: barberUserId,
      actorRole: UserRole.BARBER,
      action: 'BARBER_STARTED_JOURNEY',
      entityType: 'Assignment',
      entityId: assignmentId,
    });

    return {
      message: 'On the way to the customer',
      bookingId: booking._id.toString(),
      status: updated.status,
    };
  }

  /**
   * ACCEPTED | EN_ROUTE → ARRIVED, and refresh the customer's OTP.
   *
   * This now persists ARRIVED. Previously it only sent an SMS, so the barber's
   * dashboard showed ARRIVED locally but reverted to ACCEPTED on refresh —
   * locking them out of the OTP step.
   */
  async arriveAssignment(assignmentId: string, barberUserId: Types.ObjectId) {
    const { assignment, booking } = await this.loadOwnedAssignment(assignmentId, barberUserId);

    const updated = await assignmentStateMachine.transition(
      assignment._id,
      assignment.status,
      AssignmentStatus.ARRIVED,
    );

    const { expiresAt } = await serviceOtpService.issue(booking);

    await auditService.log({
      actorId: barberUserId,
      actorRole: UserRole.BARBER,
      action: 'BARBER_ARRIVED',
      entityType: 'Assignment',
      entityId: assignmentId,
    });

    return {
      message: 'Arrived at the customer location. Verification code sent to the customer.',
      bookingId: booking._id.toString(),
      status: updated.status,
      otpExpiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Flip the assignment to IN_PROGRESS once the customer's OTP has been
   * verified. Called by the booking OTP flow, which owns the booking side.
   */
  async markServiceStarted(
    bookingId: Types.ObjectId,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    const assignment = await assignmentRepository.findActiveByBookingId(bookingId, session);
    if (!assignment) return;
    if (assignment.status === AssignmentStatus.IN_PROGRESS) return;

    await assignmentStateMachine.transition(
      assignment._id,
      assignment.status,
      AssignmentStatus.IN_PROGRESS,
      undefined,
      session,
    );
  }

  async completeAssignment(assignmentId: string, barberUserId: Types.ObjectId) {
    const { assignment, barberProfileId, booking } = await this.loadOwnedAssignment(
      assignmentId,
      barberUserId,
    );

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new ConflictError(
        'The service must be in progress before it can be completed. Verify the customer OTP first.',
        'BOOKING_NOT_IN_PROGRESS',
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await assignmentStateMachine.transition(
          assignment._id,
          assignment.status,
          AssignmentStatus.COMPLETED,
          undefined,
          session,
        );

        await bookingStateMachine.transition(
          booking._id,
          BookingStatus.IN_PROGRESS,
          BookingStatus.COMPLETED,
          undefined,
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    await barberProfileRepository.incrementStats(barberProfileId, 'totalCompletedJobs');

    await auditService.log({
      actorId: barberUserId,
      actorRole: UserRole.BARBER,
      action: 'SERVICE_COMPLETED',
      entityType: 'Assignment',
      entityId: assignmentId,
    });

    return { message: 'Service completed', bookingId: booking._id.toString() };
  }

  /**
   * Barber backs out of a job they had taken. The booking returns to the open
   * pool (PENDING) so another barber or the admin can pick it up — there is no
   * automatic reallocation any more.
   */
  async cancelAssignment(assignmentId: string, barberUserId: Types.ObjectId, reason: string) {
    const { assignment, barberProfileId, booking } = await this.loadOwnedAssignment(
      assignmentId,
      barberUserId,
    );

    if (assignment.status === AssignmentStatus.COMPLETED) {
      throw new ConflictError('A completed job cannot be cancelled', 'ASSIGNMENT_COMPLETED');
    }
    if (assignment.status === AssignmentStatus.OFFERED) {
      throw new ConflictError(
        'Decline the offer instead of cancelling it',
        'ASSIGNMENT_NOT_ACCEPTED',
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await assignmentStateMachine.transition(
          assignment._id,
          assignment.status,
          AssignmentStatus.CANCELLED_BY_BARBER,
          { cancellationReason: reason, cancelledBy: barberUserId },
          session,
        );

        // CONFIRMED/IN_PROGRESS → BARBER_CANCELLED → PENDING (back in the pool)
        await bookingStateMachine.transition(
          booking._id,
          booking.status,
          BookingStatus.BARBER_CANCELLED,
          { cancellationReason: reason, cancelledBy: barberUserId },
          session,
        );

        await bookingStateMachine.transition(
          booking._id,
          BookingStatus.BARBER_CANCELLED,
          BookingStatus.PENDING,
          undefined,
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    await barberProfileRepository.incrementStats(barberProfileId, 'totalCancellations');

    await notificationService.notifyCustomerBookingReturnedToPool(
      booking.customerId,
      booking._id.toString(),
    );

    await auditService.log({
      actorId: barberUserId,
      actorRole: UserRole.BARBER,
      action: 'ASSIGNMENT_CANCELLED_BY_BARBER',
      entityType: 'Assignment',
      entityId: assignmentId,
      metadata: { reason },
    });

    logger.info({
      msg: 'Barber cancelled job — booking returned to pool',
      assignmentId,
      bookingId: booking._id.toString(),
    });

    return assignmentRepository.findByIdPopulated(assignmentId);
  }

  // ─── Reads ──────────────────────────────────────────────────────────────────

  /** The barber's one live job (offered or in flight), fully populated. */
  async getActiveAssignment(barberUserId: Types.ObjectId) {
    const barberProfileId = await this.requireBarberProfileId(barberUserId);
    return assignmentRepository.findActiveByBarber(barberProfileId);
  }

  /** Job history for the barber dashboard. */
  async getMyAssignments(barberUserId: Types.ObjectId, limit = 50) {
    const barberProfileId = await this.requireBarberProfileId(barberUserId);
    return assignmentRepository.findByBarber(
      barberProfileId,
      [
        AssignmentStatus.OFFERED,
        AssignmentStatus.ACCEPTED,
        AssignmentStatus.EN_ROUTE,
        AssignmentStatus.ARRIVED,
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.COMPLETED,
        AssignmentStatus.CANCELLED_BY_BARBER,
        AssignmentStatus.CANCELLED_BY_CUSTOMER,
        AssignmentStatus.REJECTED,
      ],
      limit,
    );
  }
}

export const assignmentService = new AssignmentService();
