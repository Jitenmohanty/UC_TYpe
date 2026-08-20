import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess } from '../../common/utils/response';
import { bookingRepository } from '../bookings/booking.repository';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { assignmentRepository } from '../assignments/assignment.repository';
import { allocationService } from '../allocation/allocation.service';
import { assignmentService } from '../assignments/assignment.service';
import { bookingStateMachine } from '../bookings/booking.stateMachine';
import { AllocationFailureModel } from '../allocation/allocationFailure.model';
import { AuditLogModel } from '../../audit/auditLog.model';
import { auditService } from '../../audit/audit.service';
import { userRepository } from '../users/user.repository';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { BookingStatus } from '../../common/constants/bookingStates';
import { BarberStatus, UserRole } from '../../common/constants/roles';
import { parsePagination } from '../../common/utils/pagination';
import { validate } from '../../common/middleware/validate';
import { Types } from 'mongoose';
import { z } from 'zod';

export const adminRoutes = Router();

adminRoutes.use(authenticate);
adminRoutes.use(requireRole(UserRole.ADMIN));

// ─── Bookings ─────────────────────────────────────────────────────────────────
adminRoutes.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    if (req.query['status']) filter['status'] = req.query['status'];
    const result = await bookingRepository.findAll(filter, pagination);
    sendSuccess(res, result);
  }),
);

// Manual barber assignment
adminRoutes.post(
  '/bookings/:bookingId/assign',
  validate({
    params: z.object({ bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
    body: z.object({ barberId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
  }),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const { barberId } = req.body as { barberId: string };

    const barberProfile = await barberProfileRepository.findById(barberId);
    if (!barberProfile || barberProfile.status !== BarberStatus.ACTIVE) {
      throw new NotFoundError('Active barber');
    }

    // Override: directly create assignment and confirm booking
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    const { AssignmentStatus } = await import('../../common/constants/assignmentStates');
    const assignment = await assignmentRepository.create({
      bookingId: new Types.ObjectId(bookingId),
      barberId: new Types.ObjectId(barberId),
      status: AssignmentStatus.ACCEPTED,
      acceptedAt: new Date(),
      allocationAttempt: booking.allocationAttempts + 1,
    });


    const { generateOtp, hashOtp } = await import('../../common/utils/otp.utils');
    const { twilioService } = await import('../../common/services/twilio.service');
    const otpPlain = generateOtp();
    const otpHash = hashOtp(otpPlain);
    const otpExpiry = new Date(Date.now() + 30 * 60 * 1000);

    await bookingRepository.updateStatus(booking._id, BookingStatus.CONFIRMED, {
      serviceOtp: otpHash,
      serviceOtpRaw: otpPlain,
      serviceOtpExpiresAt: otpExpiry,
      serviceOtpAttempts: 0,
    } as never);

    const customerUser = await userRepository.findById(booking.customerId);
    const barberUser = await userRepository.findById(barberProfile.userId);

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

    await auditService.log({
      actorId: req.user!.userId,
      actorRole: UserRole.ADMIN,
      action: 'ADMIN_MANUAL_ASSIGNMENT',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { barberId, assignmentId: assignment._id.toString() },
    });

    sendSuccess(res, { assignment }, 'Barber manually assigned');
  }),
);

// Trigger reallocation
adminRoutes.post(
  '/bookings/:bookingId/reallocate',
  asyncHandler(async (req, res) => {
    await allocationService.reallocate(req.params['bookingId']!);
    sendSuccess(res, null, 'Reallocation triggered');
  }),
);

// Admin cancel booking
adminRoutes.post(
  '/bookings/:bookingId/cancel',
  asyncHandler(async (req, res) => {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(req.params['bookingId']!));
    if (!booking) throw new NotFoundError('Booking');

    const reason = (req.body as { reason?: string }).reason ?? 'Admin cancelled';

    await bookingStateMachine.transition(
      booking._id,
      booking.status,
      BookingStatus.ADMIN_CANCELLED,
      {
        cancellationReason: reason,
        cancelledBy: req.user!.userId,
        cancelledAt: new Date(),
      },
    );

    // Cancel any active or offered assignment for this booking
    const activeAssignment = await assignmentRepository.findActiveByBookingId(booking._id);
    if (activeAssignment) {
      const { AssignmentStatus } = await import('../../common/constants/assignmentStates');
      await assignmentRepository.updateStatus(activeAssignment._id, AssignmentStatus.CANCELLED_BY_CUSTOMER, {
        cancellationReason: reason,
        cancelledAt: new Date(),
      });
      const { emitToUser } = await import('../../sockets/socket.server');
      const { SocketEvents } = await import('../../sockets/socket.events');
      emitToUser(activeAssignment.barberId.toString(), SocketEvents.BOOKING_CANCELLED, {
        bookingId: booking._id.toString(),
        reason,
      });
    }

    const { emitToUser } = await import('../../sockets/socket.server');
    const { SocketEvents } = await import('../../sockets/socket.events');
    emitToUser(booking.customerId.toString(), SocketEvents.BOOKING_CANCELLED, {
      bookingId: booking._id.toString(),
      reason,
    });

    await auditService.log({
      actorId: req.user!.userId,
      actorRole: UserRole.ADMIN,
      action: 'ADMIN_CANCELLED_BOOKING',
      entityType: 'Booking',
      entityId: req.params['bookingId']!,
      metadata: { reason },
    });

    sendSuccess(res, null, 'Booking cancelled by admin');
  }),
);

// ─── Barbers ──────────────────────────────────────────────────────────────────
adminRoutes.get(
  '/barbers',
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const result = await barberProfileRepository.findAll({}, pagination);
    sendSuccess(res, result);
  }),
);

adminRoutes.patch(
  '/barbers/:barberId/status',
  validate({
    params: z.object({ barberId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
    body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) }),
  }),
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: BarberStatus };
    const profile = await barberProfileRepository.updateStatus(req.params['barberId']!, status);
    if (!profile) throw new NotFoundError('Barber');

    await auditService.log({
      actorId: req.user!.userId,
      actorRole: UserRole.ADMIN,
      action: 'ADMIN_UPDATE_BARBER_STATUS',
      entityType: 'BarberProfile',
      entityId: req.params['barberId']!,
      metadata: { status },
    });

    sendSuccess(res, profile, 'Barber status updated');
  }),
);

// ─── Allocation Failures ──────────────────────────────────────────────────────
adminRoutes.get(
  '/allocation-failures',
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const { page = 1, limit = 20 } = pagination;
    const failures = await AllocationFailureModel.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('bookingId', 'bookingNumber customerId')
      .exec();
    sendSuccess(res, failures);
  }),
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────
adminRoutes.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const { page = 1, limit = 20 } = pagination;
    const logs = await AuditLogModel.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    sendSuccess(res, logs);
  }),
);
