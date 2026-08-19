import { Router } from 'express';
import * as bookingController from './booking.controller';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { idempotencyMiddleware } from '../../common/middleware/idempotency';
import { bookingRateLimiter } from '../../common/middleware/rateLimiter';
import { createBookingSchema, cancelBookingSchema, bookingQuerySchema } from './booking.schema';
import { UserRole } from '../../common/constants/roles';
import { z } from 'zod';

export const bookingRoutes = Router();

bookingRoutes.use(authenticate);

bookingRoutes.post(
  '/',
  requireRole(UserRole.CUSTOMER),
  bookingRateLimiter,
  idempotencyMiddleware,
  validate({ body: createBookingSchema }),
  bookingController.createBooking,
);

bookingRoutes.get(
  '/',
  requireRole(UserRole.CUSTOMER),
  validate({ query: bookingQuerySchema }),
  bookingController.getMyBookings,
);

bookingRoutes.get(
  '/:bookingId',
  validate({ params: z.object({ bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/) }) }),
  bookingController.getBooking,
);

bookingRoutes.post(
  '/:bookingId/cancel',
  requireRole(UserRole.CUSTOMER),
  validate({
    params: z.object({ bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
    body: cancelBookingSchema,
  }),
  bookingController.cancelBooking,
);

// ─── OTP Routes ───────────────────────────────────────────────────────────────

// Customer retrieves their service OTP
bookingRoutes.get(
  '/:bookingId/otp',
  requireRole(UserRole.CUSTOMER),
  validate({
    params: z.object({ bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
  }),
  bookingController.getBookingOtp,
);

// Customer requests Twilio SMS OTP resend
bookingRoutes.post(
  '/:bookingId/resend-otp',
  requireRole(UserRole.CUSTOMER),
  validate({
    params: z.object({ bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
  }),
  bookingController.resendBookingOtp,
);

// Barber verifies OTP to start service
bookingRoutes.post(
  '/:bookingId/verify-otp',
  requireRole(UserRole.BARBER),
  validate({
    params: z.object({ bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
    body: z.object({ otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be 6 digits') }),
  }),
  bookingController.verifyServiceOtp,
);
