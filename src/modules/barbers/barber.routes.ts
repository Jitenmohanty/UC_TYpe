import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { barberService } from './barber.service';
import { assignmentService } from '../assignments/assignment.service';
import { sendSuccess } from '../../common/utils/response';
import { locationUpdateRateLimiter } from '../../common/middleware/rateLimiter';
import { UserRole } from '../../common/constants/roles';
import { parsePagination } from '../../common/utils/pagination';
import { z } from 'zod';

export const barberRoutes = Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  serviceId: objectId.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).optional(),
});

// ─── Public ───────────────────────────────────────────────────────────────────
barberRoutes.get(
  '/nearby',
  validate({ query: nearbyQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await barberService.getNearbyBarbers(req.query as never);
    sendSuccess(res, result);
  }),
);

// ─── Barber-only ──────────────────────────────────────────────────────────────
const barberOnly = [authenticate, requireRole(UserRole.BARBER)] as const;

barberRoutes.get(
  '/me',
  ...barberOnly,
  asyncHandler(async (req, res) => {
    const result = await barberService.getMyProfile(req.user!.userId);
    sendSuccess(res, result);
  }),
);

barberRoutes.patch(
  '/me/location',
  ...barberOnly,
  locationUpdateRateLimiter,
  validate({ body: locationSchema }),
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body as { latitude: number; longitude: number };
    const result = await barberService.updateLocation(req.user!.userId, latitude, longitude);
    sendSuccess(res, result);
  }),
);

barberRoutes.patch(
  '/me/profile',
  ...barberOnly,
  validate({
    body: z.object({
      bio: z.string().max(500).optional(),
      experienceYears: z.number().int().min(0).max(70).optional(),
      serviceRadiusKm: z.number().min(1).max(50).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await barberService.updateMyProfile(req.user!.userId, req.body);
    sendSuccess(res, result);
  }),
);

/** Availability switch — whether customers see this barber at all. */
barberRoutes.patch(
  '/me/auto-allocation',
  ...barberOnly,
  validate({ body: z.object({ enabled: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const { enabled } = req.body as { enabled: boolean };
    const result = await barberService.setAcceptingBookings(req.user!.userId, enabled);
    sendSuccess(res, result);
  }),
);

/** This barber's current live job (offer or in-flight), or null. */
barberRoutes.get(
  '/me/active-assignment',
  ...barberOnly,
  asyncHandler(async (req, res) => {
    const result = await assignmentService.getActiveAssignment(req.user!.userId);
    sendSuccess(res, result);
  }),
);

/** This barber's job history. */
barberRoutes.get(
  '/me/bookings',
  ...barberOnly,
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const result = await barberService.getMyBookings(req.user!.userId, pagination);
    sendSuccess(res, result);
  }),
);

// ─── Open booking pool ────────────────────────────────────────────────────────
barberRoutes.get(
  '/pool/open-bookings',
  ...barberOnly,
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const result = await barberService.getOpenBookings(pagination);
    sendSuccess(res, result);
  }),
);

/**
 * Barber claims an open booking for themselves.
 *
 * This replaces the frontend's previous workaround of calling the ADMIN-only
 * manual-assign route (which 403'd, was swallowed, and left the UI showing a
 * success that never persisted).
 */
barberRoutes.post(
  '/pool/open-bookings/:bookingId/claim',
  ...barberOnly,
  validate({ params: z.object({ bookingId: objectId }) }),
  asyncHandler(async (req, res) => {
    const result = await barberService.claimBooking(
      req.user!.userId,
      req.params['bookingId']!,
    );
    sendSuccess(res, result, 'Booking claimed');
  }),
);

// ─── Public, parameterised — must stay last so it does not shadow /me, /pool ──
barberRoutes.get(
  '/:barberId',
  validate({ params: z.object({ barberId: objectId }) }),
  asyncHandler(async (req, res) => {
    const result = await barberService.getBarberProfile(req.params['barberId']!);
    sendSuccess(res, result);
  }),
);
