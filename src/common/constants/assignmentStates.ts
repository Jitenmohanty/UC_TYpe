export enum AssignmentStatus {
  OFFERED = 'OFFERED',
  ACCEPTED = 'ACCEPTED',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED_BY_BARBER = 'CANCELLED_BY_BARBER',
  CANCELLED_BY_CUSTOMER = 'CANCELLED_BY_CUSTOMER',
  EXPIRED = 'EXPIRED',
}

export const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, Set<AssignmentStatus>> = {
  [AssignmentStatus.OFFERED]: new Set([
    AssignmentStatus.ACCEPTED,
    AssignmentStatus.REJECTED,
    AssignmentStatus.EXPIRED,
    AssignmentStatus.CANCELLED_BY_CUSTOMER,
  ]),
  // The travel steps are optional — a barber may jump straight to the service.
  [AssignmentStatus.ACCEPTED]: new Set([
    AssignmentStatus.EN_ROUTE,
    AssignmentStatus.ARRIVED,
    AssignmentStatus.IN_PROGRESS,
    AssignmentStatus.CANCELLED_BY_BARBER,
    AssignmentStatus.CANCELLED_BY_CUSTOMER,
  ]),
  [AssignmentStatus.EN_ROUTE]: new Set([
    AssignmentStatus.ARRIVED,
    AssignmentStatus.IN_PROGRESS,
    AssignmentStatus.CANCELLED_BY_BARBER,
    AssignmentStatus.CANCELLED_BY_CUSTOMER,
  ]),
  [AssignmentStatus.ARRIVED]: new Set([
    AssignmentStatus.IN_PROGRESS,
    AssignmentStatus.CANCELLED_BY_BARBER,
    AssignmentStatus.CANCELLED_BY_CUSTOMER,
  ]),
  [AssignmentStatus.IN_PROGRESS]: new Set([
    AssignmentStatus.COMPLETED,
    AssignmentStatus.CANCELLED_BY_BARBER,
  ]),
  [AssignmentStatus.COMPLETED]: new Set(),
  [AssignmentStatus.REJECTED]: new Set(),
  [AssignmentStatus.CANCELLED_BY_BARBER]: new Set(),
  [AssignmentStatus.CANCELLED_BY_CUSTOMER]: new Set(),
  [AssignmentStatus.EXPIRED]: new Set(),
};

/**
 * An assignment in any of these statuses "owns" its booking — no other barber
 * may be assigned to it, and the booking must not appear in the open pool.
 */
export const ACTIVE_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  AssignmentStatus.OFFERED,
  AssignmentStatus.ACCEPTED,
  AssignmentStatus.EN_ROUTE,
  AssignmentStatus.ARRIVED,
  AssignmentStatus.IN_PROGRESS,
]);

/**
 * Statuses that occupy a barber's calendar slot, i.e. block a conflicting
 * booking at the same time. An OFFERED assignment does not block — it is only
 * a proposal until the barber accepts.
 */
export const SLOT_BLOCKING_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  AssignmentStatus.ACCEPTED,
  AssignmentStatus.EN_ROUTE,
  AssignmentStatus.ARRIVED,
  AssignmentStatus.IN_PROGRESS,
]);

export const TERMINAL_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  AssignmentStatus.REJECTED,
  AssignmentStatus.CANCELLED_BY_BARBER,
  AssignmentStatus.CANCELLED_BY_CUSTOMER,
  AssignmentStatus.EXPIRED,
  AssignmentStatus.COMPLETED,
]);
