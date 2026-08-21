export enum BookingStatus {
  PENDING = 'PENDING',
  OFFERED = 'OFFERED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CUSTOMER_CANCELLED = 'CUSTOMER_CANCELLED',
  BARBER_CANCELLED = 'BARBER_CANCELLED',
  EXPIRED = 'EXPIRED',
  ADMIN_CANCELLED = 'ADMIN_CANCELLED',

  // ─── Legacy ────────────────────────────────────────────────────────────────
  // Produced only by the removed auto-allocation engine. Kept so pre-existing
  // rows still validate and can be pulled back into the open pool (→ PENDING).
  SEARCHING = 'SEARCHING',
  NO_BARBER_AVAILABLE = 'NO_BARBER_AVAILABLE',
}

// Valid transitions: [fromStatus]: Set of allowed next statuses
export const BOOKING_TRANSITIONS: Record<BookingStatus, Set<BookingStatus>> = {
  // Unassigned — sitting in the open pool, visible to barbers and admin
  [BookingStatus.PENDING]: new Set([
    BookingStatus.OFFERED,
    BookingStatus.CONFIRMED,
    BookingStatus.CUSTOMER_CANCELLED,
    BookingStatus.ADMIN_CANCELLED,
  ]),
  // Offered to one specific barber (customer picked them) — awaiting their reply
  [BookingStatus.OFFERED]: new Set([
    BookingStatus.CONFIRMED,
    BookingStatus.PENDING, // barber declined → back to the pool
    BookingStatus.CUSTOMER_CANCELLED,
    BookingStatus.ADMIN_CANCELLED,
    BookingStatus.BARBER_CANCELLED,
  ]),
  [BookingStatus.CONFIRMED]: new Set([
    BookingStatus.IN_PROGRESS,
    BookingStatus.BARBER_CANCELLED,
    BookingStatus.CUSTOMER_CANCELLED,
    BookingStatus.ADMIN_CANCELLED,
  ]),
  [BookingStatus.IN_PROGRESS]: new Set([
    BookingStatus.COMPLETED,
    BookingStatus.ADMIN_CANCELLED,
  ]),
  [BookingStatus.BARBER_CANCELLED]: new Set([
    BookingStatus.PENDING, // returned to the pool for another barber
  ]),
  [BookingStatus.COMPLETED]: new Set(),
  [BookingStatus.CUSTOMER_CANCELLED]: new Set(),
  [BookingStatus.ADMIN_CANCELLED]: new Set(),
  [BookingStatus.EXPIRED]: new Set(),

  // Legacy rows can only move back into the pool or be cancelled.
  [BookingStatus.SEARCHING]: new Set([
    BookingStatus.PENDING,
    BookingStatus.OFFERED,
    BookingStatus.CONFIRMED,
    BookingStatus.CUSTOMER_CANCELLED,
    BookingStatus.ADMIN_CANCELLED,
  ]),
  [BookingStatus.NO_BARBER_AVAILABLE]: new Set([
    BookingStatus.PENDING,
    BookingStatus.CUSTOMER_CANCELLED,
    BookingStatus.ADMIN_CANCELLED,
  ]),
};

export const TERMINAL_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.COMPLETED,
  BookingStatus.CUSTOMER_CANCELLED,
  BookingStatus.ADMIN_CANCELLED,
  BookingStatus.EXPIRED,
]);

export const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.PENDING,
  BookingStatus.OFFERED,
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.SEARCHING,
]);

/**
 * Statuses a booking can sit in and still be claimed by a barber from the open
 * pool, or hand-assigned by an admin. These are exactly the bookings with no
 * active assignment attached.
 */
export const UNASSIGNED_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.PENDING,
  BookingStatus.BARBER_CANCELLED,
  BookingStatus.SEARCHING,
  BookingStatus.NO_BARBER_AVAILABLE,
]);

export const CANCELLABLE_BY_CUSTOMER_STATUSES = new Set<BookingStatus>([
  BookingStatus.PENDING,
  BookingStatus.OFFERED,
  BookingStatus.CONFIRMED,
  BookingStatus.SEARCHING,
  BookingStatus.NO_BARBER_AVAILABLE,
  BookingStatus.BARBER_CANCELLED,
]);
