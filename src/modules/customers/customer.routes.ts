import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess } from '../../common/utils/response';
import { userRepository } from '../users/user.repository';
import { NotFoundError, ForbiddenError } from '../../common/errors/AppError';
import { UserRole } from '../../common/constants/roles';
import { validate } from '../../common/middleware/validate';
import { validateCoordinates, toGeoPoint } from '../../common/utils/distance';
import { ValidationError } from '../../common/errors/AppError';
import { z } from 'zod';

export const customerRoutes = Router();

customerRoutes.use(authenticate);
customerRoutes.use(requireRole(UserRole.CUSTOMER));

customerRoutes.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await userRepository.findById(req.user!.userId);
    if (!user) throw new NotFoundError('User');
    sendSuccess(res, user);
  }),
);

customerRoutes.patch(
  '/me',
  validate({
    body: z.object({
      name: z.string().min(2).max(100).optional(),
      profileImage: z.string().url().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = await userRepository.updateById(req.user!.userId, req.body as never);
    sendSuccess(res, user, 'Profile updated');
  }),
);

customerRoutes.patch(
  '/me/location',
  validate({
    body: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body as { latitude: number; longitude: number };
    if (!validateCoordinates(latitude, longitude)) {
      throw new ValidationError('Invalid coordinates');
    }
    const user = await userRepository.updateById(req.user!.userId, {
      location: toGeoPoint(latitude, longitude),
      locationUpdatedAt: new Date(),
    } as never);
    sendSuccess(res, user, 'Location updated');
  }),
);
