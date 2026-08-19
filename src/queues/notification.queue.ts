import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis';

export interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export const notificationQueue = new Queue<NotificationJobData>('notification', {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});
