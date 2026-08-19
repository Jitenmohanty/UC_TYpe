import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../common/utils/response';
import { ServiceModel } from './service.model';
import { NotFoundError } from '../../common/errors/AppError';
import { ServiceStatus, UserRole } from '../../common/constants/roles';
import { validate } from '../../common/middleware/validate';
import { z } from 'zod';

export const serviceRoutes = Router();

const createServiceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(500),
  price: z.number().min(0),
  durationMinutes: z.number().min(5).max(480),
  categoryId: z.string().optional(),
});

// Public — list active services
serviceRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    const services = await ServiceModel.find({ status: ServiceStatus.ACTIVE })
      .sort({ name: 1 })
      .exec();
    sendSuccess(res, services);
  }),
);

serviceRoutes.get(
  '/:serviceId',
  asyncHandler(async (req, res) => {
    const service = await ServiceModel.findById(req.params['serviceId']).exec();
    if (!service || service.status !== ServiceStatus.ACTIVE) throw new NotFoundError('Service');
    sendSuccess(res, service);
  }),
);

// Admin — create/manage services
serviceRoutes.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN),
  validate({ body: createServiceSchema }),
  asyncHandler(async (req, res) => {
    const service = await ServiceModel.create(req.body);
    sendCreated(res, service, 'Service created');
  }),
);

serviceRoutes.patch(
  '/:serviceId',
  authenticate,
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const service = await ServiceModel.findByIdAndUpdate(
      req.params['serviceId'],
      { $set: req.body },
      { new: true },
    ).exec();
    if (!service) throw new NotFoundError('Service');
    sendSuccess(res, service, 'Service updated');
  }),
);
