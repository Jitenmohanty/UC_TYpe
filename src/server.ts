import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedisClient, disconnectRedis } from './config/redis';
import { env } from './config/env';
import { logger } from './common/utils/logger';

async function bootstrap(): Promise<void> {
  logger.info({ msg: 'Starting Salon Booking API server...' });

  // Connect to databases
  await connectDatabase();
  getRedisClient(); // Initialize Redis connection (locks, rate limits, idempotency)

  const app = createApp();
  const httpServer = http.createServer(app);

  // Start listening
  httpServer.listen(env.PORT, () => {
    logger.info({
      msg: `🚀 API Server running`,
      port: env.PORT,
      env: env.NODE_ENV,
      prefix: env.API_PREFIX,
    });
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ msg: `${signal} received — shutting down gracefully` });

    httpServer.close(async () => {
      try {
        await disconnectDatabase();
        await disconnectRedis();
        logger.info({ msg: 'Graceful shutdown complete' });
        process.exit(0);
      } catch (error) {
        logger.error({ msg: 'Error during shutdown', error });
        process.exit(1);
      }
    });

    // Force exit after 15s
    setTimeout(() => {
      logger.error({ msg: 'Forced shutdown after timeout' });
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error({ msg: 'Uncaught Exception', error });
    void shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ msg: 'Unhandled Rejection', reason });
    void shutdown('unhandledRejection');
  });
}

void bootstrap();
