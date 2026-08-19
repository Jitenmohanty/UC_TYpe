import { getRedisClient } from '../../config/redis';
import { logger } from '../../common/utils/logger';

const DEFAULT_LOCK_TTL_MS = 10000; // 10 seconds

export class LockService {
  private readonly redis = getRedisClient();

  /**
   * Acquire a Redis distributed lock using SET NX EX
   * Returns true if lock acquired, false if already held
   */
  async acquire(key: string, ttlMs = DEFAULT_LOCK_TTL_MS): Promise<boolean> {
    const result = await this.redis.set(key, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  /**
   * Release a lock — only release if we own it
   * (We don't store owner token here for simplicity; use with care)
   */
  async release(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Execute a function with a distributed lock
   * Automatically releases lock on completion or error
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs = DEFAULT_LOCK_TTL_MS,
  ): Promise<T | null> {
    const acquired = await this.acquire(key, ttlMs);
    if (!acquired) {
      logger.warn({ msg: 'Failed to acquire lock', key });
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.release(key);
    }
  }

  allocationLockKey(bookingId: string): string {
    return `lock:allocation:booking:${bookingId}`;
  }

  barberSlotLockKey(barberId: string, date: string, time: string): string {
    return `lock:barber:${barberId}:slot:${date}:${time}`;
  }
}

export const lockService = new LockService();
