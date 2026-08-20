import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { assignmentRepository } from './assignment.repository';
import { bookingRepository } from '../bookings/booking.repository';
import { userRepository } from '../users/user.repository';
import { assignmentStateMachine } from './assignment.stateMachine';
import { bookingStateMachine } from '../bookings/booking.stateMachine';
import { allocationService } from '../allocation/allocation.service';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { notificationService } from '../notifications/notification.service';
import { auditService } from '../../audit/audit.service';
import { lockService } from '../allocation/lock.service';
import { twilioService } from '../../common/services/twilio.service';
import { emitToUser } from '../../sockets/socket.server';
import { SocketEvents } from '../../sockets/socket.events';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../common/errors/AppError';
import { AssignmentStatus } from '../../common/constants/assignmentStates';
import { BookingStatus } from '../../common/constants/bookingStates';
import { UserRole } from '../../common/constants/roles';
import { env } from '../../config/env';
import { logger } from '../../common/utils/logger';

export class AssignmentService {
  private async isBarberOwner(assignmentBarberId: Types.ObjectId | string, barberUserId: Types.ObjectId): Promise<boolean> {
    if (assignmentBarberId.toString() === barberUserId.toString()) return true;
    const profile = await barberProfileRepository.findByUserId(barberUserId);
    if (profile && profile._id.toString() === assignmentBarberId.toString()) return true;
    return false;
  }

  async acceptAssignment(assignmentId: string, barberId: Types.ObjectId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    // Must belong to this barber (user ID or barber profile ID)
    if (!(await this.isBarberOwner(assignment.barberId, barberId))) {
      throw new ForbiddenError('This assignment does not belong to you');
    }

    // Must be OFFERED
    if (assignment.status !== AssignmentStatus.OFFERED) {
      throw new ConflictError(
        `Assignment is ${assignment.status} — cannot accept`,
        'ASSIGNMENT_NOT_OFFERED',
      );
    }

    const booking = await bookingRepository.findByIdLean(assignment.bookingId as Types.ObjectId);
    if (!booking || booking.status === BookingStatus.CUSTOMER_CANCELLED) {
      throw new ConflictError('Booking is no longer active', 'BOOKING_INACTIVE');
    }

    // Acquire slot lock to prevent race conditions
    const slotLockKey = lockService.barberSlotLockKey(
      barberId.toString(),
      booking.scheduledDate,
      booking.startTime,
    );

    const result = await lockService.withLock(slotLockKey, async () => {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Double-check: verify no conflict exists now (another booking may have been confirmed)
          const hasConflict = await assignmentRepository.hasConflict(
            barberId,
            booking.scheduledStart,
            booking.scheduledEnd,
            assignment.bookingId as Types.ObjectId,
          );

          if (hasConflict) {
            throw new ConflictError('You have a conflicting booking at this time', 'SLOT_CONFLICT');
          }

          // Accept assignment
          await assignmentStateMachine.transition(
            assignment._id,
            AssignmentStatus.OFFERED,
            AssignmentStatus.ACCEPTED,
            { acceptedAt: new Date() },
            session,
          );

          // Transition booking OFFERED → CONFIRMED
          await bookingStateMachine.transition(
            booking._id,
            BookingStatus.OFFERED,
            BookingStatus.CONFIRMED,
            undefined,
            session,
          );

          // Cancel/expire any other OFFERED assignments for this booking
          await assignmentRepository.cancelOfferedAssignments(
            booking._id,
            assignment._id,
            AssignmentStatus.EXPIRED,
            session,
          );
        });

        // Update barber stats
        await barberProfileRepository.incrementStats(barberId, 'totalAccepted');
      } finally {
        await session.endSession();
      }
    }, 15000);

    if (result === null) {
      throw new ConflictError('Could not acquire slot lock — please retry', 'SLOT_LOCK_FAILED');
    }

    // ─── Generate service OTP ──────────────────────────────────────────────
    const { generateOtp, hashOtp } = await import('../../common/utils/otp.utils');
    const otpPlain = generateOtp();
    const otpHash = hashOtp(otpPlain);
    const otpExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await bookingRepository.updateStatus(
      booking._id,
      BookingStatus.CONFIRMED, // status already set by state machine above
      {
        serviceOtp: otpHash,
        serviceOtpRaw: otpPlain,
        serviceOtpExpiresAt: otpExpiry,
        serviceOtpAttempts: 0,
      } as never,
    );

    logger.info({ msg: 'Service OTP generated for booking', bookingId: booking._id.toString() });

    // Lookup customer and barber for Twilio SMS
    const customerUser = await userRepository.findById(booking.customerId);
    const barberUser = await userRepository.findById(barberId);

    if (customerUser?.phone) {
      await twilioService.sendServiceOtpSms({
        toPhone: customerUser.phone,
        customerName: customerUser.name || 'Valued Customer',
        barberName: barberUser?.name || 'Your Assigned Barber',
        otp: otpPlain,
        serviceName: booking.serviceSnapshot.name,
        bookingNumber: booking.bookingNumber,
      });
    }

    // Notify customer with OTP
    await notificationService.notifyCustomerBookingConfirmed(
      booking.customerId,
      booking._id.toString(),
    );

    emitToUser(booking.customerId.toString(), SocketEvents.BOOKING_CONFIRMED, {
      bookingId: booking._id.toString(),
      barberId: barberId.toString(),
    });

    emitToUser(booking.customerId.toString(), SocketEvents.OTP_GENERATED, {
      bookingId: booking._id.toString(),
      otp: otpPlain,
      expiresAt: otpExpiry.toISOString(),
    });

    await auditService.log({
      actorId: barberId,
      actorRole: UserRole.BARBER,
      action: 'ASSIGNMENT_ACCEPTED',
      entityType: 'Assignment',
      entityId: assignmentId,
    });

    return assignmentRepository.findById(assignmentId);
  }

  async arriveAssignment(assignmentId: string, barberId: Types.ObjectId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');
    if (!(await this.isBarberOwner(assignment.barberId, barberId))) throw new ForbiddenError('This assignment does not belong to you');
    if (assignment.status !== AssignmentStatus.ACCEPTED) {
      throw new ConflictError('Can only mark arrived on accepted assignment', 'ASSIGNMENT_NOT_ACCEPTED');
    }

    const booking = await bookingRepository.findByIdLean(assignment.bookingId as Types.ObjectId);
    if (!booking) throw new NotFoundError('Booking');

    // Generate / refresh OTP
    const { generateOtp, hashOtp } = await import('../../common/utils/otp.utils');
    const otpPlain = booking.serviceOtpRaw || generateOtp();
    const otpHash = hashOtp(otpPlain);
    const otpExpiry = new Date(Date.now() + 30 * 60 * 1000);

    await bookingRepository.updateStatus(
      booking._id,
      booking.status,
      {
        serviceOtp: otpHash,
        serviceOtpRaw: otpPlain,
        serviceOtpExpiresAt: otpExpiry,
        serviceOtpAttempts: 0,
      } as never,
    );

    // Fetch customer & barber info for Twilio SMS dispatch
    const customerUser = await userRepository.findById(booking.customerId);
    const barberUser = await userRepository.findById(barberId);

    if (customerUser?.phone) {
      await twilioService.sendServiceOtpSms({
        toPhone: customerUser.phone,
        customerName: customerUser.name || 'Valued Customer',
        barberName: barberUser?.name || 'Your Assigned Barber',
        otp: otpPlain,
        serviceName: booking.serviceSnapshot.name,
        bookingNumber: booking.bookingNumber,
      });
    }

    emitToUser(booking.customerId.toString(), SocketEvents.OTP_GENERATED, {
      bookingId: booking._id.toString(),
      otp: otpPlain,
      expiresAt: otpExpiry.toISOString(),
    });

    logger.info({
      msg: 'Barber arrived at customer location, Twilio SMS dispatched',
      assignmentId,
      bookingId: booking._id.toString(),
    });

    return {
      message: 'Arrived at customer location. OTP generated and sent to customer via Twilio SMS and App.',
      bookingId: booking._id.toString(),
      status: 'ARRIVED',
    };
  }

  async rejectAssignment(assignmentId: string, barberId: Types.ObjectId, reason?: string) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    if (!(await this.isBarberOwner(assignment.barberId, barberId))) {
      throw new ForbiddenError('This assignment does not belong to you');
    }

    if (assignment.status !== AssignmentStatus.OFFERED) {
      throw new ConflictError('Assignment is not in OFFERED state', 'ASSIGNMENT_NOT_OFFERED');
    }

    await assignmentStateMachine.transition(
      assignment._id,
      AssignmentStatus.OFFERED,
      AssignmentStatus.REJECTED,
      { rejectedAt: new Date(), cancellationReason: reason },
    );

    // Set booking back to PENDING so Admin can manually allocate another barber
    try {
      await bookingRepository.updateStatus(assignment.bookingId as Types.ObjectId, BookingStatus.PENDING, {
        cancellationReason: reason,
      } as any);
    } catch {
      // safe fallback
    }

    logger.info({ msg: 'Assignment rejected with reason', assignmentId, reason });

    return assignmentRepository.findById(assignmentId);
  }

  async cancelAssignment(
    assignmentId: string,
    barberId: Types.ObjectId,
    reason: string,
  ) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    if (!(await this.isBarberOwner(assignment.barberId, barberId))) {
      throw new ForbiddenError('This assignment does not belong to you');
    }

    if (assignment.status !== AssignmentStatus.ACCEPTED) {
      throw new ConflictError('Can only cancel an accepted assignment', 'ASSIGNMENT_NOT_ACCEPTED');
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Cancel assignment
        await assignmentStateMachine.transition(
          assignment._id,
          AssignmentStatus.ACCEPTED,
          AssignmentStatus.CANCELLED_BY_BARBER,
          { cancelledAt: new Date(), cancellationReason: reason, cancelledBy: barberId },
          session,
        );

        // Add barber to exclusion list
        await bookingRepository.addExcludedBarber(
          assignment.bookingId,
          assignment.barberId,
          session,
        );

        // Transition booking CONFIRMED → SEARCHING (→ BARBER_CANCELLED)
        const booking = await bookingRepository.findByIdLean(
          assignment.bookingId as Types.ObjectId,
        );
        if (booking) {
          await bookingStateMachine.transition(
            booking._id,
            BookingStatus.CONFIRMED,
            BookingStatus.BARBER_CANCELLED,
            undefined,
            session,
          );

          // Then immediately transition to SEARCHING for reallocation
          await bookingStateMachine.transition(
            booking._id,
            BookingStatus.BARBER_CANCELLED,
            BookingStatus.SEARCHING,
            undefined,
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    // Update barber cancellation stats
    await barberProfileRepository.incrementStats(barberId, 'totalCancellations');

    // Trigger reallocation (barber already excluded via addExcludedBarber)
    await allocationService.reallocate(assignment.bookingId.toString());

    // Notify customer
    const booking = await bookingRepository.findByIdLean(
      assignment.bookingId as Types.ObjectId,
    );
    if (booking) {
      emitToUser(booking.customerId.toString(), SocketEvents.BOOKING_SEARCHING, {
        bookingId: booking._id.toString(),
        message: 'Your barber had to cancel. Finding a new barber...',
      });
    }

    await auditService.log({
      actorId: barberId,
      actorRole: UserRole.BARBER,
      action: 'ASSIGNMENT_CANCELLED_BY_BARBER',
      entityType: 'Assignment',
      entityId: assignmentId,
      metadata: { reason },
    });

    return assignmentRepository.findById(assignmentId);
  }

  async startAssignment(assignmentId: string, barberId: Types.ObjectId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');
    if (!(await this.isBarberOwner(assignment.barberId, barberId))) throw new ForbiddenError();
    if (assignment.status !== AssignmentStatus.ACCEPTED) {
      throw new ConflictError('Can only start an accepted assignment', 'ASSIGNMENT_NOT_ACCEPTED');
    }

    // Transition booking to IN_PROGRESS
    const booking = await bookingRepository.findByIdLean(
      assignment.bookingId as Types.ObjectId,
    );
    if (!booking) throw new NotFoundError('Booking');

    await bookingStateMachine.transition(booking._id, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS);

    return { message: 'Service started', bookingId: booking._id.toString() };
  }

  async completeAssignment(assignmentId: string, barberId: Types.ObjectId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');
    if (!(await this.isBarberOwner(assignment.barberId, barberId))) throw new ForbiddenError();

    const booking = await bookingRepository.findByIdLean(
      assignment.bookingId as Types.ObjectId,
    );
    if (!booking) throw new NotFoundError('Booking');
    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new ConflictError('Service must be IN_PROGRESS to complete', 'BOOKING_NOT_IN_PROGRESS');
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await assignmentStateMachine.transition(
          assignment._id,
          AssignmentStatus.ACCEPTED,
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

    await barberProfileRepository.incrementStats(barberId, 'totalCompletedJobs');

    emitToUser(booking.customerId.toString(), SocketEvents.BOOKING_COMPLETED, {
      bookingId: booking._id.toString(),
    });

    await auditService.log({
      actorId: barberId,
      actorRole: UserRole.BARBER,
      action: 'SERVICE_COMPLETED',
      entityType: 'Assignment',
      entityId: assignmentId,
    });

    return { message: 'Service completed', bookingId: booking._id.toString() };
  }

  async getPendingOrActiveAssignment(barberUserId: Types.ObjectId) {
    const profile = await barberProfileRepository.findByUserId(barberUserId);
    const barberIds: (Types.ObjectId | string)[] = [barberUserId];
    if (profile) barberIds.push(profile._id);

    const assignment = await assignmentRepository.findPendingOrActiveByBarber(barberIds);
    return assignment;
  }

  async startJourney(assignmentId: string, barberId: Types.ObjectId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');
    if (!(await this.isBarberOwner(assignment.barberId, barberId))) throw new ForbiddenError();

    const booking = await bookingRepository.findByIdLean(assignment.bookingId as Types.ObjectId);
    if (!booking) throw new NotFoundError('Booking');

    // Update assignment status if possible
    await assignmentRepository.updateStatus(assignment._id, 'EN_ROUTE' as AssignmentStatus);

    emitToUser(booking.customerId.toString(), SocketEvents.BARBER_LOCATION_UPDATED, {
      bookingId: booking._id.toString(),
      status: 'EN_ROUTE',
      message: 'Barber is on the way to your doorstep',
    });

    await auditService.log({
      actorId: barberId,
      actorRole: UserRole.BARBER,
      action: 'BARBER_STARTED_JOURNEY',
      entityType: 'Assignment',
      entityId: assignmentId,
    });

    return { message: 'Journey started', bookingId: booking._id.toString(), status: 'EN_ROUTE' };
  }
}

export const assignmentService = new AssignmentService();
