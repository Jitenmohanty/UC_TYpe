import {
  AssignmentStatus,
  ASSIGNMENT_TRANSITIONS,
} from '../../common/constants/assignmentStates';
import { AssignmentStateError } from '../../common/errors/AppError';
import { assignmentRepository } from './assignment.repository';
import { Types } from 'mongoose';
import mongoose from 'mongoose';

export class AssignmentStateMachine {
  canTransition(from: AssignmentStatus, to: AssignmentStatus): boolean {
    return ASSIGNMENT_TRANSITIONS[from]?.has(to) ?? false;
  }

  assertTransition(from: AssignmentStatus, to: AssignmentStatus): void {
    if (!this.canTransition(from, to)) {
      throw new AssignmentStateError(from, to);
    }
  }

  async transition(
    assignmentId: Types.ObjectId | string,
    currentStatus: AssignmentStatus,
    newStatus: AssignmentStatus,
    extra?: Partial<{
      acceptedAt: Date;
      rejectedAt: Date;
      expiredAt: Date;
      cancelledAt: Date;
      cancellationReason: string;
      cancelledBy: Types.ObjectId;
    }>,
    session?: mongoose.ClientSession,
  ) {
    this.assertTransition(currentStatus, newStatus);

    const timestampField: Partial<Record<string, Date>> = {};
    if (newStatus === AssignmentStatus.ACCEPTED) timestampField['acceptedAt'] = new Date();
    if (newStatus === AssignmentStatus.REJECTED) timestampField['rejectedAt'] = new Date();
    if (newStatus === AssignmentStatus.EXPIRED) timestampField['expiredAt'] = new Date();
    if (
      newStatus === AssignmentStatus.CANCELLED_BY_BARBER ||
      newStatus === AssignmentStatus.CANCELLED_BY_CUSTOMER
    ) {
      timestampField['cancelledAt'] = new Date();
    }

    return assignmentRepository.updateStatus(
      assignmentId,
      newStatus,
      { ...timestampField, ...(extra ?? {}) },
      session,
    );
  }
}

export const assignmentStateMachine = new AssignmentStateMachine();
