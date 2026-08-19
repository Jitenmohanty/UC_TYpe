import mongoose, { Document, Schema } from 'mongoose';

export enum NotificationType {
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  BOOKING_COMPLETED = 'BOOKING_COMPLETED',
  ASSIGNMENT_NEW = 'ASSIGNMENT_NEW',
  ASSIGNMENT_EXPIRED = 'ASSIGNMENT_EXPIRED',
  ASSIGNMENT_CANCELLED = 'ASSIGNMENT_CANCELLED',
  BARBER_ALLOCATED = 'BARBER_ALLOCATED',
  SYSTEM = 'SYSTEM',
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    data: { type: Schema.Types.Mixed },
    readAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

export const NotificationModel = mongoose.model<INotification>('Notification', notificationSchema);
