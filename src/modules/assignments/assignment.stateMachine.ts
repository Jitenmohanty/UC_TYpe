import {
  AssignmentStatus,
  ASSIGNMENT_TRANSITIONS,
} from '../../common/constants/assignmentStates';
import { AssignmentStateError } from '../../common/errors/AppError';
import { ConflictError } from '../../common/errors/AppError';
import { assignmentRepository } from './assignment.repository';
import { IAssignment } from './assignment.model';
import { Types } from 'mongoose';
import mongoose from 'mongoose';

/** Status → the timestamp field that records entering it. */
const STATUS_TIMESTAMP: Partial<Record<AssignmentStatus, keyof IAssignment>> = {
  [AssignmentStatus.ACCEPTED]: 'acceptedAt',
  [AssignmentStatus.EN_ROUTE]: 'enRouteAt',
  [AssignmentStatus.ARRIVED]: 'arrivedAt',
  [AssignmentStatus.IN_PROGRESS]: 'startedAt',
  [AssignmentStatus.COMPLETED]: 'completedAt',
  [AssignmentStatus.REJECTED]: 'rejectedAt',
  [AssignmentStatus.EXPIRED]: 'expiredAt',
  [AssignmentStatus.CANCELLED_BY_BARBER]: 'cancelledAt',
  [AssignmentStatus.CANCELLED_BY_CUSTOMER]: 'cancelledAt',
};

export class AssignmentStateMachine {
  canTransition(from: AssignmentStatus, to: AssignmentStatus): boolean {
    return ASSIGNMENT_TRANSITIONS[from]?.has(to) ?? false;
  }

  assertTransition(from: AssignmentStatus, to: AssignmentStatus): void {
    if (!this.canTransition(from, to)) {
      throw new AssignmentStateError(from, to);
    }
  }

  /**
   * Move an assignment to `newStatus`.
   *
   * `currentStatus` is the status the caller observed. The write is conditional
   * on the row still being in that status, so a concurrent request that already
   * moved it causes a ConflictError rather than a silent overwrite.
   */
  async transition(
    assignmentId: Types.ObjectId | string,
    currentStatus: AssignmentStatus,
    newStatus: AssignmentStatus,
    extra?: Partial<IAssignment>,
    session?: mongoose.ClientSession,
  ): Promise<IAssignment> {
    this.assertTransition(currentStatus, newStatus);

    const timestampField = STATUS_TIMESTAMP[newStatus];
    const stamped: Partial<IAssignment> = timestampField
      ? ({ [timestampField]: new Date() } as Partial<IAssignment>)
      : {};

    const updated = await assignmentRepository.compareAndSetStatus(
      assignmentId,
      currentStatus,
      newStatus,
      { ...stamped, ...(extra ?? {}) },
      session,
    );

    if (!updated) {
      throw new ConflictError(
        `Assignment is no longer ${currentStatus} — it was updated by someone else. Please refresh.`,
        'ASSIGNMENT_STATE_CHANGED',
      );
    }

    return updated;
  }
}

export const assignmentStateMachine = new AssignmentStateMachine();
