import { getRedisClient } from '../../config/redis';
import { logger } from '../utils/logger';

const DEFAULT_LOCK_TTL_MS = 10000; // 10 seconds

export class LockService {
  private readonly redis = getRedisClient();

  /**
   * Acquire a Redis distributed lock using SET NX PX
   * Returns true if lock acquired, false if already held
   */
  async acquire(key: string, ttlMs = DEFAULT_LOCK_TTL_MS): Promise<boolean> {
    const result = await this.redis.set(key, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async release(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Execute a function while holding a distributed lock.
   * Returns null (without running `fn`) if the lock could not be acquired.
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

  /**
   * Serialises every attempt to put a barber on one booking, so two barbers
   * claiming the same open booking (or a barber claiming while an admin
   * assigns) cannot both win.
   */
  bookingAssignmentLockKey(bookingId: string): string {
    return `lock:booking:${bookingId}:assign`;
  }

  /**
   * Serialises a single barber's calendar slot.
   * `barberProfileId` MUST be the BarberProfile `_id` — the same id stored on
   * `Assignment.barberId` — never the User id.
   */
  barberSlotLockKey(barberProfileId: string, date: string, time: string): string {
    return `lock:barber:${barberProfileId}:slot:${date}:${time}`;
  }
}

export const lockService = new LockService();
