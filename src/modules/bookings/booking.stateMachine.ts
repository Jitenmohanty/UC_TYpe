import {
  BookingStatus,
  BOOKING_TRANSITIONS,
} from '../../common/constants/bookingStates';
import { BookingStateError } from '../../common/errors/AppError';
import { bookingRepository } from './booking.repository';
import { Types } from 'mongoose';
import mongoose from 'mongoose';

export class BookingStateMachine {
  /**
   * Validate that a status transition is allowed
   */
  canTransition(from: BookingStatus, to: BookingStatus): boolean {
    return BOOKING_TRANSITIONS[from]?.has(to) ?? false;
  }

  /**
   * Assert the transition is valid, throw if not
   */
  assertTransition(from: BookingStatus, to: BookingStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BookingStateError(from, to);
    }
  }

  /**
   * Transition booking to a new status — validates and persists atomically
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
  ) {
    this.assertTransition(currentStatus, newStatus);

    const updated = await bookingRepository.updateStatus(
      bookingId,
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

    return updated;
  }
}

export const bookingStateMachine = new BookingStateMachine();
