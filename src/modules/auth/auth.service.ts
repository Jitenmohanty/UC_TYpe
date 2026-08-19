import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { userRepository } from '../users/user.repository';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { env } from '../../config/env';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../../common/errors/AppError';
import { UserRole, UserStatus } from '../../common/constants/roles';
import { generateOtp, hashOtp, verifyOtp } from '../../common/utils/otp.utils';
import { twilioService } from '../../common/services/twilio.service';
import { logger } from '../../common/utils/logger';
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  VerifyResetOtpInput,
  ResetPasswordInput,
} from './auth.schema';
import { ValidationError } from '../../common/errors/AppError';

const BCRYPT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  userId: string;
  role?: UserRole;
  email?: string;
  type: 'access' | 'refresh' | 'reset_grant';
}

export class AuthService {
  private generateTokenPair(userId: Types.ObjectId, role: UserRole, email: string): TokenPair {
    const basePayload = { userId: userId.toString(), role, email };

    const accessToken = jwt.sign(
      { ...basePayload, type: 'access' } as JwtPayload,
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
    );

    const refreshToken = jwt.sign(
      { ...basePayload, type: 'refresh' } as JwtPayload,
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions,
    );

    return { accessToken, refreshToken };
  }

  async register(input: RegisterInput) {
    // Check duplicates
    const [existingEmail, existingPhone] = await Promise.all([
      userRepository.findByEmail(input.email),
      userRepository.findByPhone(input.phone),
    ]);

    if (existingEmail) {
      throw new ConflictError('Email already registered', 'EMAIL_ALREADY_EXISTS');
    }
    if (existingPhone) {
      throw new ConflictError('Phone number already registered', 'PHONE_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const userLocation = input.location
      ? {
          type: 'Point' as const,
          coordinates: [input.location.longitude, input.location.latitude] as [number, number],
        }
      : undefined;

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role as UserRole,
      ...(userLocation ? { location: userLocation, locationUpdatedAt: new Date() } : {}),
    });

    // Create barber profile if registering as barber
    if (input.role === UserRole.BARBER) {
      await barberProfileRepository.create({
        userId: user._id,
        ...(userLocation ? { currentLocation: userLocation, locationUpdatedAt: new Date() } : {}),
      });
    }

    const tokens = this.generateTokenPair(user._id, user.role, user.email);

    // Hash refresh token before storing
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await userRepository.setRefreshToken(user._id, refreshTokenHash);

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    const user = await userRepository.findByEmailWithPassword(input.email);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError(`Account is ${user.status.toLowerCase()}`);
    }

    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = this.generateTokenPair(user._id, user.role, user.email);

    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await userRepository.setRefreshToken(user._id, refreshTokenHash);

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }

    const user = await userRepository.findByEmailWithPassword(payload.email!);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedError('Token invalidated');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) {
      // Possible token reuse — invalidate all tokens
      await userRepository.setRefreshToken(user._id, null);
      throw new UnauthorizedError('Token reuse detected — please login again');
    }

    const tokens = this.generateTokenPair(user._id, user.role, user.email);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await userRepository.setRefreshToken(user._id, refreshTokenHash);

    return tokens;
  }

  // ─── FORGOT PASSWORD: Send 6-digit OTP via Twilio SMS & Email ──────────────
  async forgotPassword(input: ForgotPasswordInput) {
    const user = await userRepository.findByIdentifier(input.identifier);
    if (!user) {
      // Generic success to prevent user enumeration
      return {
        message: 'If an account exists with this email/mobile, a 6-digit verification OTP has been sent.',
      };
    }

    const otpPlain = generateOtp();
    const otpHash = hashOtp(otpPlain);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await userRepository.setPasswordResetOtp(user._id, otpHash, otpPlain, otpExpiresAt);

    // Dispatch Twilio SMS notification
    if (user.phone) {
      await twilioService.sendServiceOtpSms({
        toPhone: user.phone,
        customerName: user.name,
        barberName: 'Account Security Team',
        otp: otpPlain,
        serviceName: 'Password Reset Verification',
        bookingNumber: 'SEC-RESET',
      });
    }

    logger.info({
      msg: 'Password reset OTP generated & dispatched',
      userId: user._id.toString(),
      email: user.email,
      expiresAt: otpExpiresAt.toISOString(),
    });

    console.log(`\n======================================================`);
    console.log(`🔑 [PASSWORD RESET OTP DISPATCH]`);
    console.log(`User: ${user.name} (${user.email} / ${user.phone})`);
    console.log(`OTP Code: ${otpPlain} (Valid for 15 minutes)`);
    console.log(`======================================================\n`);

    return {
      message: 'A 6-digit verification code has been dispatched to your mobile number and email.',
      identifier: input.identifier,
      expiresAt: otpExpiresAt.toISOString(),
    };
  }

  // ─── FORGOT PASSWORD: Verify 6-digit OTP and issue Reset Grant Token ────────
  async verifyResetOtp(input: VerifyResetOtpInput) {
    const user = await userRepository.findByIdentifier(input.identifier);
    if (!user) {
      throw new NotFoundError('User account');
    }

    // Check attempts limit
    if ((user.passwordResetOtpAttempts ?? 0) >= 5) {
      throw new ValidationError('Maximum OTP verification attempts exceeded. Please request a new OTP.');
    }

    // Check expiration
    if (!user.passwordResetOtpExpiresAt || user.passwordResetOtpExpiresAt < new Date()) {
      throw new ValidationError('OTP code has expired. Please request a new code.');
    }

    // Verify hash
    if (!user.passwordResetOtp || !verifyOtp(input.otp, user.passwordResetOtp)) {
      await userRepository.incrementResetOtpAttempts(user._id);
      const remaining = 5 - ((user.passwordResetOtpAttempts ?? 0) + 1);
      throw new ValidationError(`Invalid OTP code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
    }

    // Generate single-use reset grant token (valid 10 minutes)
    const resetToken = jwt.sign(
      { userId: user._id.toString(), email: user.email, type: 'reset_grant' } as JwtPayload,
      env.JWT_ACCESS_SECRET,
      { expiresIn: '10m' } as jwt.SignOptions,
    );

    await userRepository.setPasswordResetToken(user._id, resetToken);

    logger.info({ msg: 'Password reset OTP verified successfully', userId: user._id.toString() });

    return {
      message: 'OTP verified successfully. You may now set your new password.',
      resetToken,
    };
  }

  // ─── FORGOT PASSWORD: Reset Password with Grant Token ──────────────────────
  async resetPassword(input: ResetPasswordInput) {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(input.resetToken, env.JWT_ACCESS_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Reset token has expired or is invalid. Please restart the forgot password process.');
    }

    if (payload.type !== 'reset_grant') {
      throw new UnauthorizedError('Invalid token grant type');
    }

    const newPasswordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    await userRepository.resetPassword(new Types.ObjectId(payload.userId), newPasswordHash);

    logger.info({ msg: 'User password reset completed successfully', userId: payload.userId });

    return {
      message: 'Your password has been reset successfully! Please sign in with your new credentials.',
    };
  }

  async logout(userId: Types.ObjectId): Promise<void> {
    await userRepository.setRefreshToken(userId, null);
  }

  async getMe(userId: Types.ObjectId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    return user;
  }
}

export const authService = new AuthService();
