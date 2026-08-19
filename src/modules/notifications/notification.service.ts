import { Types } from 'mongoose';
import { notificationQueue } from '../../queues/notification.queue';
import { NotificationType } from './notification.model';
import type { IBooking } from '../bookings/booking.model';

export class NotificationService {
  async notifyBarberNewAssignment(
    barberUserId: Types.ObjectId,
    assignmentId: string,
    booking: IBooking,
  ): Promise<void> {
    await notificationQueue.add('send-notification', {
      userId: barberUserId.toString(),
      type: NotificationType.ASSIGNMENT_NEW,
      title: 'New Booking Request',
      message: `New ${booking.serviceSnapshot.name} booking on ${booking.scheduledDate} at ${booking.startTime}`,
      data: { assignmentId, bookingId: booking._id.toString() },
    });
  }

  async notifyBarberBookingCancelled(
    barberUserId: Types.ObjectId,
    bookingId: string,
  ): Promise<void> {
    await notificationQueue.add('send-notification', {
      userId: barberUserId.toString(),
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Booking Cancelled',
      message: 'The customer has cancelled their booking.',
      data: { bookingId },
    });
  }

  async notifyCustomerBookingConfirmed(
    customerId: Types.ObjectId,
    bookingId: string,
  ): Promise<void> {
    await notificationQueue.add('send-notification', {
      userId: customerId.toString(),
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'Booking Confirmed!',
      message: 'A barber has accepted your booking.',
      data: { bookingId },
    });
  }
}

export const notificationService = new NotificationService();
