export enum AssignmentStatus {
  OFFERED = 'OFFERED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED_BY_BARBER = 'CANCELLED_BY_BARBER',
  CANCELLED_BY_CUSTOMER = 'CANCELLED_BY_CUSTOMER',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
}

export const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, Set<AssignmentStatus>> = {
  [AssignmentStatus.OFFERED]: new Set([
    AssignmentStatus.ACCEPTED,
    AssignmentStatus.REJECTED,
    AssignmentStatus.EXPIRED,
    AssignmentStatus.CANCELLED_BY_CUSTOMER,
  ]),
  [AssignmentStatus.ACCEPTED]: new Set([
    AssignmentStatus.CANCELLED_BY_BARBER,
    AssignmentStatus.CANCELLED_BY_CUSTOMER,
    AssignmentStatus.COMPLETED,
  ]),
  [AssignmentStatus.REJECTED]: new Set(),
  [AssignmentStatus.CANCELLED_BY_BARBER]: new Set(),
  [AssignmentStatus.CANCELLED_BY_CUSTOMER]: new Set(),
  [AssignmentStatus.EXPIRED]: new Set(),
  [AssignmentStatus.COMPLETED]: new Set(),
};

export const ACTIVE_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  AssignmentStatus.OFFERED,
  AssignmentStatus.ACCEPTED,
]);

export const TERMINAL_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  AssignmentStatus.REJECTED,
  AssignmentStatus.CANCELLED_BY_BARBER,
  AssignmentStatus.CANCELLED_BY_CUSTOMER,
  AssignmentStatus.EXPIRED,
  AssignmentStatus.COMPLETED,
]);
