import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { bookingRepository } from './booking.repository';
import { ServiceModel } from '../services/service.model';
import { bookingStateMachine } from './booking.stateMachine';
import { assignmentRepository } from '../assignments/assignment.repository';
import { assignmentStateMachine } from '../assignments/assignment.stateMachine';
import { allocationQueue } from '../../queues/allocation.queue';
import { notificationService } from '../notifications/notification.service';
import { auditService } from '../../audit/audit.service';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../common/errors/AppError';
import { BookingStatus, CANCELLABLE_BY_CUSTOMER_STATUSES } from '../../common/constants/bookingStates';
import { AssignmentStatus, ACTIVE_ASSIGNMENT_STATUSES } from '../../common/constants/assignmentStates';
import { UserRole, BarberPreference } from '../../common/constants/roles';
import { emitToUser } from '../../sockets/socket.server';
import { getRedisStatus } from '../../config/redis';
import { SocketEvents } from '../../sockets/socket.events';
import { buildScheduledDateTime, addMinutes } from '../../common/utils/timeUtils';
import { toGeoPoint } from '../../common/utils/distance';
import { userRepository } from '../users/user.repository';
import { twilioService } from '../../common/services/twilio.service';
import { verifyOtp, generateOtp, hashOtp } from '../../common/utils/otp.utils';
import type { CreateBookingInput, CancelBookingInput } from './booking.schema';
import type { PaginationQuery } from '../../common/types/global';
import { logger } from '../../common/utils/logger';

export class BookingService {
  async createBooking(customerId: Types.ObjectId, input: CreateBookingInput) {
    // Validate service exists and is active
    const service = await ServiceModel.findById(input.serviceId).exec();
    if (!service || service.status !== 'ACTIVE') {
      throw new NotFoundError('Service');
    }

    // Validate date is in the future
    const scheduledStart = buildScheduledDateTime(input.scheduledDate, input.startTime);
    if (scheduledStart <= new Date()) {
      throw new ValidationError('Scheduled time must be in the future');
    }

    const scheduledEnd = addMinutes(scheduledStart, service.durationMinutes);

    const initialStatus = input.preferredBarberId ? BookingStatus.OFFERED : BookingStatus.PENDING;

    // Create booking
    const booking = await bookingRepository.create({
      customerId,
      serviceId: new Types.ObjectId(input.serviceId),
      barberPreference: input.barberPreference as BarberPreference,
      preferredBarberId: input.preferredBarberId
        ? new Types.ObjectId(input.preferredBarberId)
        : undefined,
      serviceSnapshot: {
        name: service.name,
        price: service.price,
        durationMinutes: service.durationMinutes,
        categoryId: service.categoryId,
      },
      customerLocation: toGeoPoint(input.customerLocation.latitude, input.customerLocation.longitude),
      addressSnapshot: input.addressSnapshot,
      scheduledDate: input.scheduledDate,
      startTime: input.startTime,
      endTime: `${scheduledEnd.getUTCHours().toString().padStart(2, '0')}:${scheduledEnd.getUTCMinutes().toString().padStart(2, '0')}`,
      scheduledStart,
      scheduledEnd,
      timezone: input.timezone,
      status: initialStatus,
    });

    // If customer selected a specific barber, create direct assignment for that barber
    if (input.preferredBarberId) {
      await assignmentRepository.create({
        bookingId: booking._id,
        barberId: new Types.ObjectId(input.preferredBarberId),
        status: AssignmentStatus.OFFERED,
        offeredAt: new Date(),
        allocationAttempt: 1,
      });
      logger.info({ msg: 'Direct assignment created for preferred barber', bookingId: booking._id.toString(), barberId: input.preferredBarberId });
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

    // Authorization: customer can only see their own bookings
    const customerIdStr = (booking.customerId as any)?._id?.toString() || booking.customerId.toString();
    if (role === UserRole.CUSTOMER && customerIdStr !== requestingUserId.toString()) {
      throw new ForbiddenError();
    }

    // Get assignment history
    const assignments = await assignmentRepository.findByBookingId(booking._id);

    return { booking, assignments };
  }

  async getMyBookings(customerId: Types.ObjectId, filter: { status?: BookingStatus }, pagination: PaginationQuery) {
    return bookingRepository.findByCustomer(customerId, filter, pagination);
  }

  async cancelBooking(
    bookingId: string,
    customerId: Types.ObjectId,
    input: CancelBookingInput,
  ) {
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

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Cancel booking
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

        // Cancel any active assignments
        const activeAssignment = await assignmentRepository.findActiveByBookingId(booking._id);
        if (activeAssignment) {
          await assignmentStateMachine.transition(
            activeAssignment._id,
            activeAssignment.status,
            AssignmentStatus.CANCELLED_BY_CUSTOMER,
            { cancelledAt: new Date() },
            session,
          );

          // Notify barber
          await notificationService.notifyBarberBookingCancelled(
            activeAssignment.barberId,
            booking._id.toString(),
          );

          emitToUser(activeAssignment.barberId.toString(), SocketEvents.BOOKING_CANCELLED, {
            bookingId: booking._id.toString(),
            reason: input.reason,
          });
        }
      });
    } finally {
      await session.endSession();
    }

    emitToUser(customerId.toString(), SocketEvents.BOOKING_CANCELLED, {
      bookingId: booking._id.toString(),
      status: BookingStatus.CUSTOMER_CANCELLED,
    });

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

  // ─── OTP: Customer retrieves their service OTP ──────────────────────────────
  async getBookingOtp(bookingId: string, customerId: Types.ObjectId) {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    if (booking.customerId.toString() !== customerId.toString()) {
      throw new ForbiddenError('You can only view your own booking OTP');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictError(
        'OTP is only available for confirmed bookings',
        'BOOKING_NOT_CONFIRMED',
      );
    }

    if (!booking.serviceOtpRaw) {
      throw new NotFoundError('OTP not generated yet');
    }

    if (booking.serviceOtpExpiresAt && booking.serviceOtpExpiresAt < new Date()) {
      // Regenerate expired OTP
      const otpPlain = generateOtp();
      const otpHash = hashOtp(otpPlain);
      const otpExpiry = new Date(Date.now() + 30 * 60 * 1000);

      await bookingRepository.updateStatus(booking._id, BookingStatus.CONFIRMED, {
        serviceOtp: otpHash,
        serviceOtpRaw: otpPlain,
        serviceOtpExpiresAt: otpExpiry,
        serviceOtpAttempts: 0,
      } as never);

      logger.info({ msg: 'Service OTP regenerated (expired)', bookingId });

      // Dispatch Twilio SMS
      const customerUser = await userRepository.findById(customerId);
      const activeAssignment = await assignmentRepository.findActiveByBookingId(booking._id);
      const barberUser = activeAssignment ? await userRepository.findById(activeAssignment.barberId) : null;

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

      return {
        otp: otpPlain,
        expiresAt: otpExpiry.toISOString(),
        bookingId: booking._id.toString(),
      };
    }

    return {
      otp: booking.serviceOtpRaw,
      expiresAt: booking.serviceOtpExpiresAt?.toISOString(),
      bookingId: booking._id.toString(),
    };
  }

  // ─── OTP: Customer requests SMS resend ───────────────────────────────────────
  async resendBookingOtp(bookingId: string, customerId: Types.ObjectId) {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    if (booking.customerId.toString() !== customerId.toString()) {
      throw new ForbiddenError('You can only request OTP for your own booking');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictError('OTP can only be resent for confirmed bookings', 'BOOKING_NOT_CONFIRMED');
    }

    const otpPlain = generateOtp();
    const otpHash = hashOtp(otpPlain);
    const otpExpiry = new Date(Date.now() + 30 * 60 * 1000);

    await bookingRepository.updateStatus(booking._id, BookingStatus.CONFIRMED, {
      serviceOtp: otpHash,
      serviceOtpRaw: otpPlain,
      serviceOtpExpiresAt: otpExpiry,
      serviceOtpAttempts: 0,
    } as never);

    const customerUser = await userRepository.findById(customerId);
    const activeAssignment = await assignmentRepository.findActiveByBookingId(booking._id);
    const barberUser = activeAssignment ? await userRepository.findById(activeAssignment.barberId) : null;

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

    emitToUser(customerId.toString(), SocketEvents.OTP_GENERATED, {
      bookingId: booking._id.toString(),
      otp: otpPlain,
      expiresAt: otpExpiry.toISOString(),
    });

    return {
      message: 'OTP resent successfully via Twilio SMS and App.',
      otp: otpPlain,
      expiresAt: otpExpiry.toISOString(),
      bookingId: booking._id.toString(),
    };
  }

  // ─── OTP: Barber verifies OTP to start the service ──────────────────────────
  async verifyServiceOtp(bookingId: string, barberId: Types.ObjectId, otp: string) {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictError(
        'OTP verification is only for confirmed bookings',
        'BOOKING_NOT_CONFIRMED',
      );
    }

    // Verify the barber is the assigned barber for this booking
    const activeAssignment = await assignmentRepository.findActiveByBookingId(booking._id);
    const { barberProfileRepository } = await import('../barbers/barberProfile.repository');
    const profile = await barberProfileRepository.findByUserId(barberId);
    const isAssigned =
      activeAssignment &&
      (activeAssignment.barberId.toString() === barberId.toString() ||
        (profile && activeAssignment.barberId.toString() === profile._id.toString()));

    if (!isAssigned) {
      throw new ForbiddenError('You are not assigned to this booking');
    }

    // Check OTP not expired
    if (booking.serviceOtpExpiresAt && booking.serviceOtpExpiresAt < new Date()) {
      throw new ConflictError('OTP has expired. Customer can request a new one.', 'OTP_EXPIRED');
    }

    // Check max attempts (brute-force protection)
    if ((booking.serviceOtpAttempts ?? 0) >= 5) {
      throw new ConflictError(
        'Maximum OTP attempts exceeded. Customer can request a new OTP.',
        'OTP_MAX_ATTEMPTS',
      );
    }

    // Verify the OTP hash
    if (!booking.serviceOtp || !verifyOtp(otp, booking.serviceOtp)) {
      // Increment attempts
      await bookingRepository.incrementOtpAttempts(booking._id);
      const remaining = 5 - ((booking.serviceOtpAttempts ?? 0) + 1);
      throw new ValidationError(
        `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      );
    }

    // ✅ OTP verified — transition booking CONFIRMED → IN_PROGRESS
    await bookingStateMachine.transition(
      booking._id,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    );

    await bookingRepository.updateStatus(booking._id, BookingStatus.IN_PROGRESS, {
      serviceOtpVerifiedAt: new Date(),
    } as never);

    // Dispatch Twilio service started confirmation SMS to customer
    const customerUser = await userRepository.findById(booking.customerId);
    const barberUser = await userRepository.findById(barberId);

    if (customerUser?.phone) {
      await twilioService.sendServiceStartedSms({
        toPhone: customerUser.phone,
        customerName: customerUser.name || 'Valued Customer',
        barberName: barberUser?.name || 'Your Assigned Barber',
        serviceName: booking.serviceSnapshot.name,
        bookingNumber: booking.bookingNumber,
      });
    }

    // Notify both parties via Socket.IO
    emitToUser(booking.customerId.toString(), SocketEvents.SERVICE_STARTED, {
      bookingId: booking._id.toString(),
      barberId: barberId.toString(),
    });

    emitToUser(barberId.toString(), SocketEvents.OTP_VERIFIED, {
      bookingId: booking._id.toString(),
    });

    await auditService.log({
      actorId: barberId,
      actorRole: UserRole.BARBER,
      action: 'OTP_VERIFIED_SERVICE_STARTED',
      entityType: 'Booking',
      entityId: bookingId,
    });

    logger.info({ msg: 'OTP verified — service started', bookingId, barberId: barberId.toString() });

    return {
      message: 'OTP verified. Service started.',
      bookingId: booking._id.toString(),
      status: BookingStatus.IN_PROGRESS,
    };
  }
}

export const bookingService = new BookingService();

