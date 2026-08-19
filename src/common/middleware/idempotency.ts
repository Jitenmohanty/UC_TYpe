import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../../config/redis';
import { logger } from '../utils/logger';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

interface CachedResponse {
  statusCode: number;
  body: unknown;
}

/**
 * Idempotency middleware — prevents duplicate mutations using Idempotency-Key header
 * If same key is seen within 24h, returns the cached response
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  if (!idempotencyKey) {
    return next();
  }

  const userId = req.user?.userId?.toString() ?? 'anon';
  const redisKey = `idempotency:${userId}:${idempotencyKey}`;

  try {
    const redis = getRedisClient();
    const cached = await redis.get(redisKey);

    if (cached) {
      const parsed = JSON.parse(cached) as CachedResponse;
      logger.info({ msg: 'Returning cached idempotent response', idempotencyKey });
      res.status(parsed.statusCode).json(parsed.body);
      return;
    }

    // Intercept the response to cache it
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const statusCode = res.statusCode;
      // Only cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        const cached: CachedResponse = { statusCode, body };
        redis
          .set(redisKey, JSON.stringify(cached), 'EX', IDEMPOTENCY_TTL_SECONDS)
          .catch((err) => logger.error({ msg: 'Failed to cache idempotent response', error: err }));
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.warn({ msg: 'Idempotency middleware error, falling through', error });
    next();
  }
}
