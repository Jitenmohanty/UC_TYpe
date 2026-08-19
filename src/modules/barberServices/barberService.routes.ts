import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../common/utils/response';
import { BarberServiceModel } from './barberService.model';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { ServiceModel } from '../services/service.model';
import { NotFoundError, ConflictError } from '../../common/errors/AppError';
import { UserRole } from '../../common/constants/roles';
import { validate } from '../../common/middleware/validate';
import { z } from 'zod';

export const barberServiceRoutes = Router();

barberServiceRoutes.use(authenticate);
barberServiceRoutes.use(requireRole(UserRole.BARBER));

const addServiceSchema = z.object({
  serviceId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  price: z.number().min(0),
  durationOverride: z.number().min(5).max(480).optional(),
});

barberServiceRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const profile = await barberProfileRepository.findByUserId(req.user!.userId);
    if (!profile) throw new NotFoundError('Barber profile');
    const services = await BarberServiceModel.find({ barberId: profile._id, isActive: true })
      .populate('serviceId', 'name description price durationMinutes')
      .exec();
    sendSuccess(res, services);
  }),
);

barberServiceRoutes.post(
  '/',
  validate({ body: addServiceSchema }),
  asyncHandler(async (req, res) => {
    const profile = await barberProfileRepository.findByUserId(req.user!.userId);
    if (!profile) throw new NotFoundError('Barber profile');

    const service = await ServiceModel.findById((req.body as { serviceId: string }).serviceId).exec();
    if (!service) throw new NotFoundError('Service');

    const existing = await BarberServiceModel.findOne({
      barberId: profile._id,
      serviceId: service._id,
    }).exec();

    if (existing) {
      if (existing.isActive) throw new ConflictError('Service already added', 'SERVICE_ALREADY_ADDED');
      // Reactivate
      existing.isActive = true;
      existing.price = (req.body as { price: number }).price;
      await existing.save();
      sendSuccess(res, existing, 'Service reactivated');
      return;
    }

    const bs = await BarberServiceModel.create({
      barberId: profile._id,
      ...req.body,
    });
    sendCreated(res, bs, 'Service added');
  }),
);

barberServiceRoutes.patch(
  '/:serviceId',
  asyncHandler(async (req, res) => {
    const profile = await barberProfileRepository.findByUserId(req.user!.userId);
    if (!profile) throw new NotFoundError('Barber profile');
    const bs = await BarberServiceModel.findOneAndUpdate(
      { barberId: profile._id, serviceId: req.params['serviceId'] },
      { $set: req.body },
      { new: true },
    ).exec();
    if (!bs) throw new NotFoundError('Barber service');
    sendSuccess(res, bs, 'Service updated');
  }),
);

barberServiceRoutes.delete(
  '/:serviceId',
  asyncHandler(async (req, res) => {
    const profile = await barberProfileRepository.findByUserId(req.user!.userId);
    if (!profile) throw new NotFoundError('Barber profile');
    await BarberServiceModel.findOneAndUpdate(
      { barberId: profile._id, serviceId: req.params['serviceId'] },
      { $set: { isActive: false } },
    ).exec();
    sendSuccess(res, null, 'Service removed');
  }),
);
