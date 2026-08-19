import { Worker } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../common/utils/logger';
import { NotificationModel } from '../modules/notifications/notification.model';
import { NotificationType } from '../modules/notifications/notification.model';
import type { NotificationJobData } from '../queues/notification.queue';

export const notificationWorker = new Worker<NotificationJobData>(
  'notification',
  async (job) => {
    const { userId, type, title, message, data } = job.data;

    logger.info({ msg: 'Processing notification job', jobId: job.id, userId, type });

    // Persist in-app notification
    await NotificationModel.create({
      userId,
      type: type as NotificationType,
      title,
      message,
      data,
    });

    // TODO: Push to FCM, email, SMS providers based on user preferences
  },
  {
    connection: getRedisClient(),
    concurrency: 10,
  },
);

notificationWorker.on('failed', (job, error) => {
  logger.error({ msg: 'Notification job failed', jobId: job?.id, error: error.message });
});
