import { Types } from 'mongoose';
import { bookingRepository } from './booking.repository';
import { IBooking } from './booking.model';
import { assignmentRepository } from '../assignments/assignment.repository';
import { barberProfileRepository } from '../barbers/barberProfile.repository';
import { userRepository } from '../users/user.repository';
import { twilioService } from '../../common/services/twilio.service';
import { generateOtp, hashOtp, verifyOtp } from '../../common/utils/otp.utils';
import { logger } from '../../common/utils/logger';

export const OTP_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const OTP_MAX_ATTEMPTS = 5;

export interface IssuedOtp {
  otp: string;
  expiresAt: Date;
}

/**
 * One place that mints, stores and delivers the doorstep service OTP.
 *
 * Previously this logic was copy-pasted across assignment accept, barber
 * arrive, customer resend, expired-OTP refresh and admin manual assign — five
 * near-identical blocks that had already drifted apart.
 */
export class ServiceOtpService {
  /**
   * Generate a fresh OTP for a booking, persist it, and SMS it to the customer.
   * Status is left untouched.
   */
  async issue(booking: IBooking, options: { sendSms?: boolean } = {}): Promise<IssuedOtp> {
    const { sendSms = true } = options;

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await bookingRepository.updateFields(booking._id, {
      serviceOtp: hashOtp(otp),
      serviceOtpRaw: otp,
      serviceOtpExpiresAt: expiresAt,
      serviceOtpAttempts: 0,
      serviceOtpVerifiedAt: undefined,
    } as Partial<IBooking>);

    if (sendSms) {
      await this.sendSms(booking, otp);
    }

    logger.info({ msg: 'Service OTP issued', bookingId: booking._id.toString() });

    return { otp, expiresAt };
  }

  /**
   * Return the booking's current OTP, minting a new one if it is missing or
   * expired.
   */
  async getOrRefresh(booking: IBooking): Promise<IssuedOtp> {
    const otp = booking.serviceOtpRaw;
    const expiresAt = booking.serviceOtpExpiresAt;

    // Checked inline so TypeScript narrows both optionals for the return below.
    if (!otp || !expiresAt || expiresAt < new Date()) {
      return this.issue(booking);
    }

    return { otp, expiresAt };
  }

  /**
   * Check a barber-supplied code against the stored hash.
   * Increments the attempt counter on a miss.
   */
  async verify(
    booking: IBooking,
    candidate: string,
  ): Promise<{ ok: true } | { ok: false; reason: 'EXPIRED' | 'MAX_ATTEMPTS' | 'INVALID'; attemptsRemaining: number }> {
    if (booking.serviceOtpExpiresAt && booking.serviceOtpExpiresAt < new Date()) {
      return { ok: false, reason: 'EXPIRED', attemptsRemaining: 0 };
    }

    const used = booking.serviceOtpAttempts ?? 0;
    if (used >= OTP_MAX_ATTEMPTS) {
      return { ok: false, reason: 'MAX_ATTEMPTS', attemptsRemaining: 0 };
    }

    if (!booking.serviceOtp || !verifyOtp(candidate, booking.serviceOtp)) {
      await bookingRepository.incrementOtpAttempts(booking._id);
      return {
        ok: false,
        reason: 'INVALID',
        attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - (used + 1)),
      };
    }

    return { ok: true };
  }

  /** Resolve the assigned barber's display name, for the SMS body. */
  private async resolveBarberName(bookingId: Types.ObjectId): Promise<string> {
    const assignment = await assignmentRepository.findActiveByBookingId(bookingId);
    if (!assignment) return 'Your Assigned Barber';

    const profile = await barberProfileRepository.findById(assignment.barberId);
    if (!profile) return 'Your Assigned Barber';

    const barberUser = await userRepository.findById(profile.userId);
    return barberUser?.name || 'Your Assigned Barber';
  }

  private async sendSms(booking: IBooking, otp: string): Promise<void> {
    const customer = await userRepository.findById(booking.customerId);
    if (!customer?.phone) {
      logger.warn({
        msg: 'Skipping OTP SMS — customer has no phone on file',
        bookingId: booking._id.toString(),
      });
      return;
    }

    const barberName = await this.resolveBarberName(booking._id);

    try {
      await twilioService.sendServiceOtpSms({
        toPhone: customer.phone,
        customerName: customer.name || 'Valued Customer',
        barberName,
        otp,
        serviceName: booking.serviceSnapshot.name,
        bookingNumber: booking.bookingNumber,
      });
    } catch (error) {
      // SMS delivery must never block the booking lifecycle — the customer can
      // always read the code from their dashboard card.
      logger.error({
        msg: 'OTP SMS dispatch failed',
        bookingId: booking._id.toString(),
        error: (error as Error)?.message,
      });
    }
  }
}

export const serviceOtpService = new ServiceOtpService();
