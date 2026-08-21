import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { bookingRepository } from './booking.repository';
import { serviceOtpService } from './serviceOtp.service';
import { bookingStateMachine } from './booking.stateMachine';
import { ServiceModel } from '../services/service.model';
import { assignmentRepository } from '../assignments/assignment.repository';
import { assignmentStateMachine } from '../assignments/assignment.stateMachine';
import { assignmentService } from '../assignments/assignment.service';
import { AssignmentSource } from '../assignments/assignment.model';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { notificationService } from '../notifications/notification.service';
import { auditService } from '../../audit/audit.service';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../../common/errors/AppError';
import {
  BookingStatus,
  CANCELLABLE_BY_CUSTOMER_STATUSES,
} from '../../common/constants/bookingStates';
import { AssignmentStatus } from '../../common/constants/assignmentStates';
import { UserRole, BarberPreference, BarberStatus } from '../../common/constants/roles';
import { buildScheduledDateTime, addMinutes } from '../../common/utils/timeUtils';
import { toGeoPoint } from '../../common/utils/distance';
import type { CreateBookingInput, CancelBookingInput } from './booking.schema';
import type { PaginationQuery } from '../../common/types/global';
import { logger } from '../../common/utils/logger';

export class BookingService {
  /**
   * Create a booking.
   *
   * There is no automatic dispatch. A booking lands in one of two places:
   *  - customer picked a specific barber → OFFERED to that barber only
   *  - otherwise                        → PENDING, visible in the open pool to
   *                                       every barber and in the admin console
   */
  async createBooking(customerId: Types.ObjectId, input: CreateBookingInput) {
    const service = await ServiceModel.findById(input.serviceId).exec();
    if (!service || service.status !== 'ACTIVE') {
      throw new NotFoundError('Service');
    }

    const scheduledStart = buildScheduledDateTime(input.scheduledDate, input.startTime);
    if (scheduledStart <= new Date()) {
      throw new ValidationError('Scheduled time must be in the future');
    }
    const scheduledEnd = addMinutes(scheduledStart, service.durationMinutes);

    // Validate the preferred barber up-front so we never create a booking that
    // points at an inactive or non-existent barber.
    let preferredBarber = null;
    if (input.preferredBarberId) {
      preferredBarber = await barberProfileRepository.findById(input.preferredBarberId);
      if (!preferredBarber || preferredBarber.status !== BarberStatus.ACTIVE) {
        throw new NotFoundError('Requested barber');
      }
    }

    const booking = await bookingRepository.create({
      customerId,
      serviceId: new Types.ObjectId(input.serviceId),
      barberPreference: input.barberPreference as BarberPreference,
      preferredBarberId: preferredBarber?._id,
      serviceSnapshot: {
        name: service.name,
        price: service.price,
        durationMinutes: service.durationMinutes,
        categoryId: service.categoryId,
      },
      customerLocation: toGeoPoint(
        input.customerLocation.latitude,
        input.customerLocation.longitude,
      ),
      addressSnapshot: input.addressSnapshot,
      scheduledDate: input.scheduledDate,
      startTime: input.startTime,
      endTime: `${scheduledEnd.getUTCHours().toString().padStart(2, '0')}:${scheduledEnd
        .getUTCMinutes()
        .toString()
        .padStart(2, '0')}`,
      scheduledStart,
      scheduledEnd,
      timezone: input.timezone,
      status: preferredBarber ? BookingStatus.OFFERED : BookingStatus.PENDING,
    });

    if (preferredBarber) {
      const assignment = await assignmentRepository.create({
        bookingId: booking._id,
        barberId: preferredBarber._id,
        status: AssignmentStatus.OFFERED,
        source: AssignmentSource.CUSTOMER_CHOICE,
        offeredAt: new Date(),
      });

      await barberProfileRepository.incrementStats(preferredBarber._id, 'totalOffered');
      await notificationService.notifyBarberNewOffer(
        preferredBarber.userId,
        assignment._id.toString(),
        booking,
      );

      logger.info({
        msg: 'Booking offered to customer-selected barber',
        bookingId: booking._id.toString(),
        barberId: preferredBarber._id.toString(),
      });
    } else {
      logger.info({
        msg: 'Booking added to open pool',
        bookingId: booking._id.toString(),
      });
    }

    await auditService.log({
      actorId: customerId,
      actorRole: UserRole.CUSTOMER,
      action: 'BOOKING_CREATED',
      entityType: 'Booking',
      entityId: booking._id.toString(),
    });

    return booking;
  }

  async getBooking(bookingId: string, requestingUserId: Types.ObjectId, role: UserRole) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const customerIdStr =
      (booking.customerId as unknown as { _id?: Types.ObjectId })?._id?.toString() ??
      booking.customerId.toString();

    if (role === UserRole.CUSTOMER && customerIdStr !== requestingUserId.toString()) {
      throw new ForbiddenError();
    }

    const assignments = await assignmentRepository.findByBookingId(booking._id);

    return { booking, assignments };
  }

  async getMyBookings(
    customerId: Types.ObjectId,
    filter: { status?: BookingStatus },
    pagination: PaginationQuery,
  ) {
    return bookingRepository.findByCustomer(customerId, filter, pagination);
  }

  async cancelBooking(bookingId: string, customerId: Types.ObjectId, input: CancelBookingInput) {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    if (booking.customerId.toString() !== customerId.toString()) {
      throw new ForbiddenError('You can only cancel your own bookings');
    }

    if (!CANCELLABLE_BY_CUSTOMER_STATUSES.has(booking.status)) {
      throw new ConflictError(
        `Cannot cancel a booking in ${booking.status} state`,
        'BOOKING_CANNOT_BE_CANCELLED',
      );
    }

    const activeAssignment = await assignmentRepository.findActiveByBookingId(booking._id);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await bookingStateMachine.transition(
          booking._id,
          booking.status,
          BookingStatus.CUSTOMER_CANCELLED,
          {
            cancellationReason: input.reason,
            cancelledBy: customerId,
            cancelledAt: new Date(),
          },
          session,
        );

        if (activeAssignment) {
          await assignmentStateMachine.transition(
            activeAssignment._id,
            activeAssignment.status,
            AssignmentStatus.CANCELLED_BY_CUSTOMER,
            { cancellationReason: input.reason, cancelledBy: customerId },
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    // Tell the assigned barber, if there was one.
    if (activeAssignment) {
      const profile = await barberProfileRepository.findById(activeAssignment.barberId);
      if (profile) {
        await notificationService.notifyBarberBookingCancelled(
          profile.userId,
          booking._id.toString(),
          input.reason,
        );
      }
    }

    await auditService.log({
      actorId: customerId,
      actorRole: UserRole.CUSTOMER,
      action: 'BOOKING_CANCELLED',
      entityType: 'Booking',
      entityId: booking._id.toString(),
      metadata: { reason: input.reason },
    });

    return bookingRepository.findById(booking._id);
  }

  // ─── OTP ────────────────────────────────────────────────────────────────────

  /** Customer reads their doorstep code. Refreshed automatically if expired. */
  async getBookingOtp(bookingId: string, customerId: Types.ObjectId) {
    const booking = await this.requireOwnConfirmedBooking(bookingId, customerId);
    const { otp, expiresAt } = await serviceOtpService.getOrRefresh(booking);

    return {
      otp,
      expiresAt: expiresAt.toISOString(),
      bookingId: booking._id.toString(),
    };
  }

  /** Customer asks for a fresh code by SMS. */
  async resendBookingOtp(bookingId: string, customerId: Types.ObjectId) {
    const booking = await this.requireOwnConfirmedBooking(bookingId, customerId);
    const { otp, expiresAt } = await serviceOtpService.issue(booking);

    return {
      message: 'A new verification code has been sent to your phone.',
      otp,
      expiresAt: expiresAt.toISOString(),
      bookingId: booking._id.toString(),
    };
  }

  /** Barber submits the customer's code to start the service. */
  async verifyServiceOtp(bookingId: string, barberUserId: Types.ObjectId, otp: string) {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictError(
        'OTP verification is only available for confirmed bookings',
        'BOOKING_NOT_CONFIRMED',
      );
    }

    // Only the barber actually holding this booking may verify.
    const profile = await barberProfileRepository.findByUserId(barberUserId);
    if (!profile) throw new NotFoundError('Barber profile');

    const activeAssignment = await assignmentRepository.findActiveByBookingId(booking._id);
    if (!activeAssignment || activeAssignment.barberId.toString() !== profile._id.toString()) {
      throw new ForbiddenError('You are not assigned to this booking');
    }

    const result = await serviceOtpService.verify(booking, otp);
    if (!result.ok) {
      switch (result.reason) {
        case 'EXPIRED':
          throw new ConflictError(
            'This code has expired. Ask the customer to request a new one.',
            'OTP_EXPIRED',
          );
        case 'MAX_ATTEMPTS':
          throw new ConflictError(
            'Too many incorrect attempts. Ask the customer to request a new code.',
            'OTP_MAX_ATTEMPTS',
          );
        default:
          throw new ValidationError(
            `Incorrect code. ${result.attemptsRemaining} attempt${
              result.attemptsRemaining === 1 ? '' : 's'
            } remaining.`,
          );
      }
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await bookingStateMachine.transition(
          booking._id,
          BookingStatus.CONFIRMED,
          BookingStatus.IN_PROGRESS,
          undefined,
          session,
        );

        await bookingRepository.updateFields(
          booking._id,
          { serviceOtpVerifiedAt: new Date() },
          session,
        );

        await assignmentService.markServiceStarted(booking._id, session);
      });
    } finally {
      await session.endSession();
    }

    await auditService.log({
      actorId: barberUserId,
      actorRole: UserRole.BARBER,
      action: 'OTP_VERIFIED_SERVICE_STARTED',
      entityType: 'Booking',
      entityId: bookingId,
    });

    logger.info({ msg: 'OTP verified — service started', bookingId });

    return {
      message: 'Code verified. Service started.',
      bookingId: booking._id.toString(),
      status: BookingStatus.IN_PROGRESS,
    };
  }

  private async requireOwnConfirmedBooking(bookingId: string, customerId: Types.ObjectId) {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    if (booking.customerId.toString() !== customerId.toString()) {
      throw new ForbiddenError('You can only access your own booking');
    }

    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.IN_PROGRESS
    ) {
      throw new ConflictError(
        'A verification code is only available once a barber has been assigned',
        'BOOKING_NOT_CONFIRMED',
      );
    }

    return booking;
  }
}

export const bookingService = new BookingService();
