import {
  BookingStatus,
  BOOKING_TRANSITIONS,
} from '../../common/constants/bookingStates';
import { BookingStateError, ConflictError } from '../../common/errors/AppError';
import { bookingRepository } from './booking.repository';
import { IBooking } from './booking.model';
import { Types } from 'mongoose';
import mongoose from 'mongoose';

export class BookingStateMachine {
  canTransition(from: BookingStatus, to: BookingStatus): boolean {
    return BOOKING_TRANSITIONS[from]?.has(to) ?? false;
  }

  assertTransition(from: BookingStatus, to: BookingStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BookingStateError(from, to);
    }
  }

  /**
   * Move a booking to `newStatus`.
   *
   * `currentStatus` is the status the caller observed. The write is conditional
   * on the booking still being in that status, so a concurrent request that
   * already moved it raises a ConflictError instead of being overwritten.
   */
  async transition(
    bookingId: Types.ObjectId | string,
    currentStatus: BookingStatus,
    newStatus: BookingStatus,
    extra?: {
      cancellationReason?: string;
      cancelledBy?: Types.ObjectId;
      cancelledAt?: Date;
    },
    session?: mongoose.ClientSession,
  ): Promise<IBooking> {
    this.assertTransition(currentStatus, newStatus);

    const updated = await bookingRepository.compareAndSetStatus(
      bookingId,
      currentStatus,
      newStatus,
      extra
        ? {
            cancellationReason: extra.cancellationReason,
            cancelledBy: extra.cancelledBy,
            cancelledAt: extra.cancelledAt ?? new Date(),
          }
        : undefined,
      session,
    );

    if (!updated) {
      throw new ConflictError(
        `Booking is no longer ${currentStatus} — it was updated by someone else. Please refresh.`,
        'BOOKING_STATE_CHANGED',
      );
    }

    return updated;
  }
}

export const bookingStateMachine = new BookingStateMachine();
