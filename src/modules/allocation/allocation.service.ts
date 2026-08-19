import mongoose, { Types } from 'mongoose';
import { bookingRepository } from '../bookings/booking.repository';
import { assignmentRepository } from '../assignments/assignment.repository';
import { AllocationFailureModel } from './allocationFailure.model';
import { candidateService } from './candidate.service';
import { rankingService } from './ranking.service';
import { lockService } from './lock.service';
import { bookingStateMachine } from '../bookings/booking.stateMachine';
import { assignmentStateMachine } from '../assignments/assignment.stateMachine';
import { notificationService } from '../notifications/notification.service';
import { allocationQueue } from '../../queues/allocation.queue';
import { expirationQueue } from '../../queues/expiration.queue';
import { BookingStatus, TERMINAL_BOOKING_STATUSES } from '../../common/constants/bookingStates';
import { AssignmentStatus } from '../../common/constants/assignmentStates';
import { AllocationFailureReason } from '../../common/constants/roles';
import { env, getAllocationRetryDelays } from '../../config/env';
import { logger } from '../../common/utils/logger';
import { emitToUser } from '../../sockets/socket.server';
import { SocketEvents } from '../../sockets/socket.events';

export class AllocationService {
  /**
   * Main allocation entry point — called by allocation worker
   * Implements the full 12-step allocation flow with distributed locking
   */
  async allocateBooking(bookingId: string, attemptNumber: number): Promise<void> {
    const lockKey = lockService.allocationLockKey(bookingId);

    const result = await lockService.withLock(lockKey, async () => {
      return this.executeAllocation(bookingId, attemptNumber);
    }, 30000); // 30s lock TTL

    if (result === null) {
      logger.warn({ msg: 'Could not acquire allocation lock', bookingId, attemptNumber });
      // Retry the allocation job with delay
      await this.scheduleRetry(bookingId, attemptNumber);
    }
  }

  private async executeAllocation(bookingId: string, attemptNumber: number): Promise<void> {
    // Step 1: Load booking
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) {
      logger.error({ msg: 'Booking not found for allocation', bookingId });
      return;
    }

    // Step 2: Guard — stop if booking is terminal
    if (TERMINAL_BOOKING_STATUSES.has(booking.status) || booking.status === BookingStatus.CONFIRMED) {
      logger.info({
        msg: 'Skipping allocation — booking in terminal state',
        bookingId,
        status: booking.status,
      });
      return;
    }

    // Increment attempt counter
    await bookingRepository.incrementAllocationAttempts(bookingId);

    logger.info({ msg: 'Starting allocation', bookingId, attemptNumber });

    // Step 3+4+5: Find and filter eligible candidates
    const eligibleCandidates = await candidateService.findEligibleCandidates(booking);

    if (eligibleCandidates.length === 0) {
      await this.handleNoCandidate(booking._id.toString(), booking, attemptNumber);
      return;
    }

    // Step 6: Rank candidates
    const rankedCandidates = rankingService.rank(eligibleCandidates);
    const best = rankingService.selectBest(rankedCandidates);

    if (!best) {
      await this.handleNoCandidate(booking._id.toString(), booking, attemptNumber);
      return;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Step 7: Check for duplicate active assignment (race condition guard)
        const existing = await assignmentRepository.findActiveByBookingId(booking._id);
        if (existing) {
          logger.info({ msg: 'Active assignment already exists — skipping', bookingId });
          return;
        }

        // Step 8: Create assignment atomically
        const assignment = await assignmentRepository.create(
          {
            bookingId: booking._id,
            barberId: best.profile._id,
            status: AssignmentStatus.OFFERED,
            allocationAttempt: attemptNumber,
            offeredAt: new Date(),
            distanceAtAllocation: best.distanceKm,
            allocationScore: best.score,
          },
          session,
        );

        // Step 9: Transition booking SEARCHING → OFFERED
        await bookingStateMachine.transition(
          booking._id,
          booking.status === BookingStatus.PENDING ? BookingStatus.SEARCHING : booking.status,
          BookingStatus.OFFERED,
          undefined,
          session,
        );

        // Step 10: Create offer expiration job
        const expirationJob = await expirationQueue.add(
          'expire-assignment',
          {
            assignmentId: assignment._id.toString(),
            bookingId: booking._id.toString(),
          },
          { delay: env.ASSIGNMENT_OFFER_TIMEOUT_SECONDS * 1000 },
        );

        // Store expiration job ID in assignment
        await assignmentRepository.setExpirationJobId(
          assignment._id,
          expirationJob.id ?? '',
        );

        logger.info({
          msg: 'Assignment created',
          bookingId,
          barberId: best.profile._id.toString(),
          score: best.score,
          distanceKm: best.distanceKm,
        });

        // Step 11: Notify barber
        await notificationService.notifyBarberNewAssignment(
          best.profile.userId,
          assignment._id.toString(),
          booking,
        );

        // Emit real-time socket event to barber
        emitToUser(best.profile.userId.toString(), SocketEvents.ASSIGNMENT_NEW, {
          assignmentId: assignment._id.toString(),
          bookingId: booking._id.toString(),
          service: booking.serviceSnapshot,
          scheduledDate: booking.scheduledDate,
          startTime: booking.startTime,
          customerLocation: booking.customerLocation,
        });

        // Emit to customer that a barber was found
        emitToUser(booking.customerId.toString(), SocketEvents.BOOKING_ASSIGNED, {
          bookingId: booking._id.toString(),
          status: BookingStatus.OFFERED,
        });
      });
    } catch (error) {
      logger.error({ msg: 'Allocation transaction failed', bookingId, error });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async handleNoCandidate(
    bookingId: string,
    booking: Awaited<ReturnType<typeof bookingRepository.findByIdLean>>,
    attemptNumber: number,
  ): Promise<void> {
    if (!booking) return;

    const retryDelays = getAllocationRetryDelays();
    const maxAttempts = env.MAX_ALLOCATION_ATTEMPTS;

    if (attemptNumber < maxAttempts) {
      // Schedule retry
      await this.scheduleRetry(bookingId, attemptNumber);
      return;
    }

    // Max attempts reached — mark as NO_BARBER_AVAILABLE
    logger.warn({ msg: 'Max allocation attempts reached', bookingId, attemptNumber });

    await AllocationFailureModel.create({
      bookingId: booking._id,
      reason: AllocationFailureReason.MAX_ATTEMPTS_REACHED,
      requestedService: booking.serviceSnapshot.name,
      requestedLocation: booking.customerLocation,
      requestedDate: booking.scheduledDate,
      requestedTime: booking.startTime,
      radiusKm: env.DEFAULT_ALLOCATION_RADIUS_KM,
      candidateCount: 0,
      attemptNumber,
    });

    await bookingStateMachine.transition(
      booking._id,
      booking.status,
      BookingStatus.NO_BARBER_AVAILABLE,
    );

    emitToUser(booking.customerId.toString(), SocketEvents.BOOKING_SEARCHING, {
      bookingId: bookingId,
      status: BookingStatus.NO_BARBER_AVAILABLE,
      message: 'No barber available for your request',
    });
  }

  private async scheduleRetry(bookingId: string, attemptNumber: number): Promise<void> {
    const retryDelays = getAllocationRetryDelays();
    const delaySeconds = retryDelays[attemptNumber] ?? 120;

    await allocationQueue.add(
      'allocate-booking',
      { bookingId, attemptNumber: attemptNumber + 1 },
      { delay: delaySeconds * 1000 },
    );

    logger.info({
      msg: 'Allocation retry scheduled',
      bookingId,
      nextAttempt: attemptNumber + 1,
      delaySeconds,
    });
  }

  /**
   * Re-run allocation (e.g. after barber cancels)
   */
  async reallocate(bookingId: string): Promise<void> {
    const booking = await bookingRepository.findByIdLean(new Types.ObjectId(bookingId));
    if (!booking) return;

    await allocationQueue.add('allocate-booking', {
      bookingId,
      attemptNumber: booking.allocationAttempts + 1,
    });
  }
}

export const allocationService = new AllocationService();
