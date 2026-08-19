import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis';

export interface ExpirationJobData {
  assignmentId: string;
  bookingId: string;
}

export const expirationQueue = new Queue<ExpirationJobData>('expiration', {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});
