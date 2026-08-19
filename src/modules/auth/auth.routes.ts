import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import {
  loginRateLimiter,
  forgotPasswordRateLimiter,
  otpVerificationRateLimiter,
} from '../../common/middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} from './auth.schema';

export const authRoutes = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 */
authRoutes.post(
  '/register',
  validate({ body: registerSchema }),
  authController.register,
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 */
authRoutes.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginSchema }),
  authController.login,
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using refresh token
 */
authRoutes.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  authController.refreshToken,
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request 6-digit password reset OTP via SMS/Email
 */
authRoutes.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);

/**
 * @openapi
 * /auth/verify-reset-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify 6-digit password reset OTP and obtain reset grant token
 */
authRoutes.post(
  '/verify-reset-otp',
  otpVerificationRateLimiter,
  validate({ body: verifyResetOtpSchema }),
  authController.verifyResetOtp,
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset account password using reset grant token
 */
authRoutes.post(
  '/reset-password',
  forgotPasswordRateLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate refresh token
 *     security:
 *       - bearerAuth: []
 */
authRoutes.post('/logout', authenticate, authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 */
authRoutes.get('/me', authenticate, authController.getMe);
