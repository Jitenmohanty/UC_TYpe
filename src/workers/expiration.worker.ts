import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis';
import { assignmentRepository } from '../modules/assignments/assignment.repository';
import { bookingRepository } from '../modules/bookings/booking.repository';
import { assignmentStateMachine } from '../modules/assignments/assignment.stateMachine';
import { allocationService } from '../modules/allocation/allocation.service';
import { AssignmentStatus } from '../common/constants/assignmentStates';
import { BookingStatus } from '../common/constants/bookingStates';
import { notificationService } from '../modules/notifications/notification.service';
import { logger } from '../common/utils/logger';
import { emitToUser } from '../sockets/socket.server';
import { SocketEvents } from '../sockets/socket.events';
import type { ExpirationJobData } from '../queues/expiration.queue';
import { Types } from 'mongoose';

export const expirationWorker = new Worker<ExpirationJobData>(
  'expiration',
  async (job) => {
    const { assignmentId, bookingId } = job.data;

    logger.info({ msg: 'Processing assignment expiration', jobId: job.id, assignmentId });

    const assignment = await assignmentRepository.findById(assignmentId);

    if (!assignment) {
      logger.warn({ msg: 'Assignment not found for expiration', assignmentId });
      return;
    }

    if (assignment.status !== AssignmentStatus.OFFERED) {
      logger.info({
        msg: 'Assignment no longer OFFERED — skipping expiration',
        assignmentId,
        status: assignment.status,
      });
      return;
    }

    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking || booking.status === BookingStatus.CUSTOMER_CANCELLED) {
      logger.info({ msg: 'Booking cancelled — skipping expiration', bookingId });
      return;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Expire the assignment
        await assignmentStateMachine.transition(
          assignment._id,
          AssignmentStatus.OFFERED,
          AssignmentStatus.EXPIRED,
          { expiredAt: new Date() },
          session,
        );
      });

      // Notify barber that offer expired
      emitToUser(assignment.barberId.toString(), SocketEvents.ASSIGNMENT_EXPIRED, {
        assignmentId,
        bookingId,
      });

      // Trigger re-allocation
      await allocationService.reallocate(bookingId);

      logger.info({ msg: 'Assignment expired — reallocation triggered', assignmentId, bookingId });
    } finally {
      await session.endSession();
    }
  },
  {
    connection: getRedisClient(),
    concurrency: 10,
  },
);

expirationWorker.on('failed', (job, error) => {
  logger.error({ msg: 'Expiration job failed', jobId: job?.id, error: error.message });
});
