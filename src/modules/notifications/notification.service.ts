import { Types } from 'mongoose';
import { notificationRepository } from './notification.repository';
import { NotificationType } from './notification.model';
import { logger } from '../../common/utils/logger';
import type { IBooking } from '../bookings/booking.model';

/**
 * In-app notifications.
 *
 * These are written synchronously now that the BullMQ notification queue is
 * gone. A failed write must never fail the booking action that triggered it, so
 * every method swallows-and-logs rather than throwing.
 */
export class NotificationService {
  private async write(
    userId: Types.ObjectId | string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await notificationRepository.create({
        userId: new Types.ObjectId(userId.toString()),
        type,
        title,
        message,
        data,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to persist notification',
        type,
        userId: userId.toString(),
        error: (error as Error)?.message,
      });
    }
  }

  /** Customer picked this barber directly — they have a pending offer. */
  async notifyBarberNewOffer(
    barberUserId: Types.ObjectId,
    assignmentId: string,
    booking: IBooking,
  ): Promise<void> {
    await this.write(
      barberUserId,
      NotificationType.ASSIGNMENT_NEW,
      'New Booking Request',
      `${booking.serviceSnapshot.name} on ${booking.scheduledDate} at ${booking.startTime}`,
      { assignmentId, bookingId: booking._id.toString() },
    );
  }

  async notifyBarberBookingCancelled(
    barberUserId: Types.ObjectId,
    bookingId: string,
    reason?: string,
  ): Promise<void> {
    await this.write(
      barberUserId,
      NotificationType.BOOKING_CANCELLED,
      'Booking Cancelled',
      reason
        ? `This booking was cancelled: ${reason}`
        : 'This booking was cancelled.',
      { bookingId, reason },
    );
  }

  async notifyCustomerBookingConfirmed(
    customerId: Types.ObjectId,
    bookingId: string,
  ): Promise<void> {
    await this.write(
      customerId,
      NotificationType.BOOKING_CONFIRMED,
      'Booking Confirmed',
      'A barber has been assigned to your booking.',
      { bookingId },
    );
  }

  /** Barber backed out — the booking is waiting for a new one. */
  async notifyCustomerBookingReturnedToPool(
    customerId: Types.ObjectId,
    bookingId: string,
  ): Promise<void> {
    await this.write(
      customerId,
      NotificationType.ASSIGNMENT_CANCELLED,
      'Barber Unavailable',
      'Your barber had to cancel. Your booking is back in the queue for another barber.',
      { bookingId },
    );
  }

  async notifyCustomerBookingCancelled(
    customerId: Types.ObjectId,
    bookingId: string,
    reason?: string,
  ): Promise<void> {
    await this.write(
      customerId,
      NotificationType.BOOKING_CANCELLED,
      'Booking Cancelled',
      reason ? `Your booking was cancelled: ${reason}` : 'Your booking was cancelled.',
      { bookingId, reason },
    );
  }
}

export const notificationService = new NotificationService();
