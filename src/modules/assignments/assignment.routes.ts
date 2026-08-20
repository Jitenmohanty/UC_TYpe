import { Router } from 'express';
import * as assignmentController from './assignment.controller';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '../../common/constants/roles';
import { z } from 'zod';

export const assignmentRoutes = Router();

assignmentRoutes.use(authenticate);
assignmentRoutes.use(requireRole(UserRole.BARBER));

const assignmentIdSchema = z.object({
  assignmentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignment ID'),
});

assignmentRoutes.get(
  '/pending',
  assignmentController.getPendingAssignment,
);

assignmentRoutes.post(
  '/:assignmentId/accept',
  validate({ params: assignmentIdSchema }),
  assignmentController.acceptAssignment,
);

assignmentRoutes.post(
  '/:assignmentId/reject',
  validate({
    params: assignmentIdSchema,
    body: z.object({ reason: z.string().max(500).optional() }),
  }),
  assignmentController.rejectAssignment,
);

assignmentRoutes.post(
  '/:assignmentId/start-journey',
  validate({ params: assignmentIdSchema }),
  assignmentController.startJourney,
);

assignmentRoutes.post(
  '/:assignmentId/cancel',
  validate({
    params: assignmentIdSchema,
    body: z.object({ reason: z.string().min(1).max(500) }),
  }),
  assignmentController.cancelAssignment,
);

assignmentRoutes.post(
  '/:assignmentId/arrive',
  validate({ params: assignmentIdSchema }),
  assignmentController.arriveAssignment,
);

assignmentRoutes.post(
  '/:assignmentId/start',
  validate({ params: assignmentIdSchema }),
  assignmentController.startAssignment,
);

assignmentRoutes.post(
  '/:assignmentId/start-service',
  validate({ params: assignmentIdSchema }),
  assignmentController.startAssignment,
);

assignmentRoutes.post(
  '/:assignmentId/complete',
  validate({ params: assignmentIdSchema }),
  assignmentController.completeAssignment,
);
