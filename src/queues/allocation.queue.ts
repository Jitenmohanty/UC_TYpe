import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis';

export interface AllocationJobData {
  bookingId: string;
  attemptNumber: number;
}

export const allocationQueue = new Queue<AllocationJobData>('allocation', {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 1, // Retry logic handled by the allocation service itself
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});
