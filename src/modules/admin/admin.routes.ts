import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess } from '../../common/utils/response';
import { bookingRepository } from '../bookings/booking.repository';
import { bookingStateMachine } from '../bookings/booking.stateMachine';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { assignmentRepository } from '../assignments/assignment.repository';
import { assignmentStateMachine } from '../assignments/assignment.stateMachine';
import { assignmentService } from '../assignments/assignment.service';
import { AssignmentSource } from '../assignments/assignment.model';
import { notificationService } from '../notifications/notification.service';
import { AuditLogModel } from '../../audit/auditLog.model';
import { auditService } from '../../audit/audit.service';
import { NotFoundError } from '../../common/errors/AppError';
import { BookingStatus } from '../../common/constants/bookingStates';
import { AssignmentStatus } from '../../common/constants/assignmentStates';
import { BarberStatus, UserRole } from '../../common/constants/roles';
import { parsePagination, buildPaginatedResult } from '../../common/utils/pagination';
import { z } from 'zod';

export const adminRoutes = Router();

adminRoutes.use(authenticate);
adminRoutes.use(requireRole(UserRole.ADMIN));

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

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

/**
 * Real platform counters for the dashboard tiles — previously the frontend
 * displayed hardcoded placeholder figures.
 */
adminRoutes.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [byStatus, completedRevenue, barbers] = await Promise.all([
      bookingRepository.countByStatus(),
      bookingRepository.sumCompletedRevenue(),
      barberProfileRepository.findAll({}, { page: 1, limit: 1 }),
    ]);

    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    const completed = byStatus[BookingStatus.COMPLETED] ?? 0;
    const awaitingAssignment =
      (byStatus[BookingStatus.PENDING] ?? 0) +
      (byStatus[BookingStatus.BARBER_CANCELLED] ?? 0) +
      (byStatus[BookingStatus.SEARCHING] ?? 0) +
      (byStatus[BookingStatus.NO_BARBER_AVAILABLE] ?? 0);

    sendSuccess(res, {
      totalBookings: total,
      completedBookings: completed,
      awaitingAssignment,
      inProgress: byStatus[BookingStatus.IN_PROGRESS] ?? 0,
      confirmed: byStatus[BookingStatus.CONFIRMED] ?? 0,
      completedRevenue,
      completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      totalBarbers: barbers.total,
      byStatus,
    });
  }),
);

/**
 * Hand-assign a barber to a booking.
 *
 * Shares assignmentService.assignBarber with the barber self-claim path, so
 * both get the same lock, transaction, duplicate-assignment guard, slot-conflict
 * check and state-machine validation. Previously this route wrote the
 * assignment and booking status directly, with none of those.
 */
adminRoutes.post(
  '/bookings/:bookingId/assign',
  validate({
    params: z.object({ bookingId: objectId }),
    body: z.object({ barberId: objectId }),
  }),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const { barberId } = req.body as { barberId: string };

    const assignment = await assignmentService.assignBarber({
      bookingId,
      barberProfileId: barberId,
      source: AssignmentSource.ADMIN_ASSIGN,
      actorId: req.user!.userId,
      actorRole: UserRole.ADMIN,
    });

    sendSuccess(res, { assignment }, 'Barber assigned and booking confirmed');
  }),
);

adminRoutes.post(
  '/bookings/:bookingId/cancel',
  validate({
    params: z.object({ bookingId: objectId }),
    body: z.object({ reason: z.string().max(500).optional() }),
  }),
  asyncHandler(async (req, res) => {
    const bookingId = req.params['bookingId']!;
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) throw new NotFoundError('Booking');

    const reason = (req.body as { reason?: string }).reason ?? 'Cancelled by administrator';
    const activeAssignment = await assignmentRepository.findActiveByBookingId(booking._id);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await bookingStateMachine.transition(
          booking._id,
          booking.status,
          BookingStatus.ADMIN_CANCELLED,
          {
            cancellationReason: reason,
            cancelledBy: req.user!.userId,
            cancelledAt: new Date(),
          },
          session,
        );

        if (activeAssignment) {
          await assignmentStateMachine.transition(
            activeAssignment._id,
            activeAssignment.status,
            AssignmentStatus.CANCELLED_BY_CUSTOMER,
            { cancellationReason: reason, cancelledBy: req.user!.userId },
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    await notificationService.notifyCustomerBookingCancelled(
      booking.customerId,
      bookingId,
      reason,
    );

    if (activeAssignment) {
      const profile = await barberProfileRepository.findById(activeAssignment.barberId);
      if (profile) {
        await notificationService.notifyBarberBookingCancelled(profile.userId, bookingId, reason);
      }
    }

    await auditService.log({
      actorId: req.user!.userId,
      actorRole: UserRole.ADMIN,
      action: 'ADMIN_CANCELLED_BOOKING',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { reason },
    });

    sendSuccess(res, null, 'Booking cancelled');
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
    params: z.object({ barberId: objectId }),
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

// ─── Audit Logs ───────────────────────────────────────────────────────────────
adminRoutes.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const [data, total] = await Promise.all([
      AuditLogModel.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      AuditLogModel.countDocuments().exec(),
    ]);
    sendSuccess(res, buildPaginatedResult(data, total, page, limit));
  }),
);
