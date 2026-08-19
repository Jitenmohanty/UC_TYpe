import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email address').toLowerCase(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Please enter a valid 10 to 15 digit mobile number (e.g. +919876543210 or 9876543210)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  role: z.enum(['CUSTOMER', 'BARBER']).default('CUSTOMER'),
  location: z
    .object({
      latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
      longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
    })
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3, 'Email or Mobile number is required').trim(),
});

export const verifyResetOtpSchema = z.object({
  identifier: z.string().min(3, 'Email or Mobile number is required').trim(),
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset grant token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
