import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../utils/logger';

// In-memory store as fallback (single instance only)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs: number;   // milliseconds
  max: number;        // max requests in window
  keyPrefix: string;
  message?: string;
}

function createRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const userId = req.user?.userId?.toString() ?? '';
    const key = `rl:${options.keyPrefix}:${userId || ip}`;

    try {
      const redis = getRedisClient();
      if (redis.status === 'ready') {
        const windowSeconds = Math.floor(options.windowMs / 1000);
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, windowSeconds);
        }
        const ttl = await redis.ttl(key);

        res.setHeader('X-RateLimit-Limit', options.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - current));
        res.setHeader('X-RateLimit-Reset', Date.now() + ttl * 1000);

        if (current > options.max) {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: options.message ?? 'Too many requests. Please try again later.',
            },
          });
          return;
        }
        return next();
      }
    } catch (error) {
      logger.warn({ msg: 'Redis rate limiter error, using memory fallback', error });
    }

    // In-Memory Fallback
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || now > entry.resetAt) {
      memoryStore.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', options.max - 1);
      res.setHeader('X-RateLimit-Reset', now + options.windowMs);
      return next();
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - entry.count));
    res.setHeader('X-RateLimit-Reset', entry.resetAt);

    if (entry.count > options.max) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: options.message ?? 'Too many requests. Please try again later.',
        },
      });
      return;
    }

    next();
  };
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.RATE_LIMIT_LOGIN_PER_HOUR,
  keyPrefix: 'login',
  message: 'Too many login attempts. Please try again in an hour.',
});

export const bookingRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.RATE_LIMIT_BOOKING_PER_HOUR,
  keyPrefix: 'booking',
  message: 'Too many booking requests. Please try again later.',
});

export const locationUpdateRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: env.RATE_LIMIT_LOCATION_UPDATE_PER_MINUTE,
  keyPrefix: 'location',
});

export const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyPrefix: 'general',
});

export const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyPrefix: 'forgot_pw',
  message: 'Too many password reset requests. Please try again in 15 minutes.',
});

export const otpVerificationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8,
  keyPrefix: 'verify_otp',
  message: 'Too many OTP verification attempts. Please try again later.',
});
