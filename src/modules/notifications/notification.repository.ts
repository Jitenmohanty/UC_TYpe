import { Types } from 'mongoose';
import { NotificationModel, INotification } from './notification.model';

export class NotificationRepository {
  async create(data: Partial<INotification>): Promise<INotification> {
    return NotificationModel.create(data);
  }

  async findByUser(
    userId: Types.ObjectId | string,
    unreadOnly = false,
    limit = 20,
  ): Promise<INotification[]> {
    const filter: Record<string, unknown> = { userId };
    if (unreadOnly) filter['readAt'] = null;
    return NotificationModel.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
  }

  async markAsRead(
    notificationId: Types.ObjectId | string,
    userId: Types.ObjectId | string,
  ): Promise<void> {
    await NotificationModel.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { readAt: new Date() } },
    ).exec();
  }

  async markAllAsRead(userId: Types.ObjectId | string): Promise<void> {
    await NotificationModel.updateMany(
      { userId, readAt: null },
      { $set: { readAt: new Date() } },
    ).exec();
  }
}

export const notificationRepository = new NotificationRepository();
