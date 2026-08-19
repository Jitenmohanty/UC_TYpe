import { Request, Response } from 'express';
import { bookingService } from './booking.service';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess, sendCreated, buildPaginatedMeta } from '../../common/utils/response';
import { parsePagination } from '../../common/utils/pagination';
import type { CreateBookingInput, CancelBookingInput } from './booking.schema';
import { BookingStatus } from '../../common/constants/bookingStates';

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingService.createBooking(req.user!.userId, req.body as CreateBookingInput);
  sendCreated(res, booking, 'Booking created. Searching for available barber...');
});

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const result = await bookingService.getBooking(
    req.params['bookingId']!,
    req.user!.userId,
    req.user!.role,
  );
  sendSuccess(res, result);
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const status = req.query['status'] as BookingStatus | undefined;
  const result = await bookingService.getMyBookings(req.user!.userId, { status }, pagination);
  sendSuccess(res, result.data, undefined, 200, buildPaginatedMeta(result));
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingService.cancelBooking(
    req.params['bookingId']!,
    req.user!.userId,
    req.body as CancelBookingInput,
  );
  sendSuccess(res, booking, 'Booking cancelled successfully');
});

// ─── OTP: Customer retrieves their service OTP ───────────────────────────────
export const getBookingOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await bookingService.getBookingOtp(
    req.params['bookingId']!,
    req.user!.userId,
  );
  sendSuccess(res, result, 'Service OTP retrieved');
});

// ─── OTP: Customer requests Twilio SMS resend ────────────────────────────────
export const resendBookingOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await bookingService.resendBookingOtp(
    req.params['bookingId']!,
    req.user!.userId,
  );
  sendSuccess(res, result, 'Service OTP resent via Twilio SMS');
});

// ─── OTP: Barber verifies OTP to start service ──────────────────────────────
export const verifyServiceOtp = asyncHandler(async (req: Request, res: Response) => {
  const { otp } = req.body as { otp: string };
  const result = await bookingService.verifyServiceOtp(
    req.params['bookingId']!,
    req.user!.userId,
    otp,
  );
  sendSuccess(res, result, 'OTP verified — service started');
});
