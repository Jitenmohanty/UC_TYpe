import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { barberService } from './barber.service';
import { sendSuccess } from '../../common/utils/response';
import { locationUpdateRateLimiter } from '../../common/middleware/rateLimiter';
import { UserRole } from '../../common/constants/roles';
import { z } from 'zod';

export const barberRoutes = Router();

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  serviceId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).optional(),
});

// Public routes
barberRoutes.get(
  '/nearby',
  validate({ query: nearbyQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await barberService.getNearbyBarbers(req.query as never);
    sendSuccess(res, result);
  }),
);

// Protected routes (Barber only)
barberRoutes.get(
  '/me',
  authenticate,
  requireRole(UserRole.BARBER),
  asyncHandler(async (req, res) => {
    const result = await barberService.getMyProfile(req.user!.userId);
    sendSuccess(res, result);
  }),
);

barberRoutes.patch(
  '/me/location',
  authenticate,
  requireRole(UserRole.BARBER),
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
  authenticate,
  requireRole(UserRole.BARBER),
  asyncHandler(async (req, res) => {
    const result = await barberService.updateMyProfile(req.user!.userId, req.body);
    sendSuccess(res, result);
  }),
);

barberRoutes.patch(
  '/me/auto-allocation',
  authenticate,
  requireRole(UserRole.BARBER),
  asyncHandler(async (req, res) => {
    const { enabled } = req.body as { enabled: boolean };
    const result = await barberService.toggleAutoAllocation(req.user!.userId, enabled);
    sendSuccess(res, result);
  }),
);

barberRoutes.get(
  '/me/bookings',
  authenticate,
  requireRole(UserRole.BARBER),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as Record<string, string>;
    const result = await barberService.getMyBookings(req.user!.userId, {
      page: parseInt(page ?? '1', 10),
      limit: parseInt(limit ?? '20', 10),
    });
    sendSuccess(res, result);
  }),
);

barberRoutes.get(
  '/:barberId',
  validate({ params: z.object({ barberId: z.string().regex(/^[0-9a-fA-F]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    const result = await barberService.getBarberProfile(req.params['barberId']!);
    sendSuccess(res, result);
  }),
);
