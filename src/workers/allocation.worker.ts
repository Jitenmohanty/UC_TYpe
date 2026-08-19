import { Worker } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { allocationService } from '../modules/allocation/allocation.service';
import { logger } from '../common/utils/logger';
import type { AllocationJobData } from '../queues/allocation.queue';

export const allocationWorker = new Worker<AllocationJobData>(
  'allocation',
  async (job) => {
    const { bookingId, attemptNumber } = job.data;

    logger.info({
      msg: 'Processing allocation job',
      jobId: job.id,
      bookingId,
      attemptNumber,
    });

    await allocationService.allocateBooking(bookingId, attemptNumber);
  },
  {
    connection: getRedisClient(),
    concurrency: 5, // Process 5 allocations concurrently
    limiter: {
      max: 50,
      duration: 1000,
    },
  },
);

allocationWorker.on('completed', (job) => {
  logger.info({ msg: 'Allocation job completed', jobId: job.id, bookingId: job.data.bookingId });
});

allocationWorker.on('failed', (job, error) => {
  logger.error({
    msg: 'Allocation job failed',
    jobId: job?.id,
    bookingId: job?.data.bookingId,
    error: error.message,
  });
});
