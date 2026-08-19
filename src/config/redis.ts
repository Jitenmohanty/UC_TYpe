import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from '../common/utils/logger';

let redisClient: Redis | null = null;
let redisSubscriberClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required for BullMQ
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy(times) {
        if (env.NODE_ENV === 'test' && times > 2) {
          return null; // Stop retrying in test mode if Redis is unavailable
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('connect', () => {
      logger.info({ msg: 'Redis connected' });
    });

    redisClient.on('error', (err) => {
      logger.error({ msg: 'Redis error', error: err });
    });

    redisClient.on('reconnecting', () => {
      logger.warn({ msg: 'Redis reconnecting' });
    });
  }
  return redisClient;
}

// Separate subscriber client (cannot be shared with BullMQ connection)
export function getRedisSubscriberClient(): Redis {
  if (!redisSubscriberClient) {
    redisSubscriberClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (env.NODE_ENV === 'test' && times > 2) {
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });
  }
  return redisSubscriberClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
        await redisClient.quit();
      } else {
        redisClient.disconnect();
      }
    } catch (err) {
      // Ignore disconnect errors
    }
    redisClient = null;
  }
  if (redisSubscriberClient) {
    try {
      if (redisSubscriberClient.status === 'ready' || redisSubscriberClient.status === 'connecting') {
        await redisSubscriberClient.quit();
      } else {
        redisSubscriberClient.disconnect();
      }
    } catch (err) {
      // Ignore disconnect errors
    }
    redisSubscriberClient = null;
  }
  logger.info({ msg: 'Redis disconnected gracefully' });
}

export function getRedisStatus(): string {
  if (!redisClient) return 'not_initialized';
  return redisClient.status;
}
