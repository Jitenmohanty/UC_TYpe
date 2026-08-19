import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedisClient, disconnectRedis } from './config/redis';
import { allocationWorker } from './workers/allocation.worker';
import { notificationWorker } from './workers/notification.worker';
import { expirationWorker } from './workers/expiration.worker';
import { logger } from './common/utils/logger';

async function bootstrapWorker(): Promise<void> {
  logger.info({ msg: 'Starting Salon Booking Worker process...' });

  await connectDatabase();
  getRedisClient();

  // Start all workers
  allocationWorker.run();
  notificationWorker.run();
  expirationWorker.run();

  logger.info({ msg: '⚙️  Workers started', workers: ['allocation', 'notification', 'expiration'] });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ msg: `${signal} received — shutting down workers` });
    try {
      await allocationWorker.close();
      await notificationWorker.close();
      await expirationWorker.close();
      await disconnectDatabase();
      await disconnectRedis();
      logger.info({ msg: 'Workers shutdown complete' });
      process.exit(0);
    } catch (error) {
      logger.error({ msg: 'Error during worker shutdown', error });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error({ msg: 'Worker uncaught exception', error });
    void shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ msg: 'Worker unhandled rejection', reason });
    void shutdown('unhandledRejection');
  });
}

void bootstrapWorker();
