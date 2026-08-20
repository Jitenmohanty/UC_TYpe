export enum BookingStatus {
  PENDING = 'PENDING',
  SEARCHING = 'SEARCHING',
  OFFERED = 'OFFERED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CUSTOMER_CANCELLED = 'CUSTOMER_CANCELLED',
  BARBER_CANCELLED = 'BARBER_CANCELLED',
  EXPIRED = 'EXPIRED',
  NO_BARBER_AVAILABLE = 'NO_BARBER_AVAILABLE',
  ADMIN_CANCELLED = 'ADMIN_CANCELLED',
}

// Valid transitions: [fromStatus]: Set of allowed next statuses
export const BOOKING_TRANSITIONS: Record<BookingStatus, Set<BookingStatus>> = {
  [BookingStatus.PENDING]: new Set([BookingStatus.SEARCHING, BookingStatus.CUSTOMER_CANCELLED]),
  [BookingStatus.SEARCHING]: new Set([
    BookingStatus.OFFERED,
    BookingStatus.NO_BARBER_AVAILABLE,
    BookingStatus.CUSTOMER_CANCELLED,
    BookingStatus.ADMIN_CANCELLED,
  ]),
  [BookingStatus.OFFERED]: new Set([
    BookingStatus.CONFIRMED,
    BookingStatus.SEARCHING,
    BookingStatus.CUSTOMER_CANCELLED,
    BookingStatus.ADMIN_CANCELLED,
  ]),
  [BookingStatus.CONFIRMED]: new Set([
    BookingStatus.IN_PROGRESS,
    BookingStatus.BARBER_CANCELLED,
    BookingStatus.CUSTOMER_CANCELLED,
    BookingStatus.ADMIN_CANCELLED,
  ]),
  [BookingStatus.IN_PROGRESS]: new Set([BookingStatus.COMPLETED, BookingStatus.ADMIN_CANCELLED]),
  [BookingStatus.COMPLETED]: new Set(),
  [BookingStatus.CUSTOMER_CANCELLED]: new Set(),
  [BookingStatus.BARBER_CANCELLED]: new Set([BookingStatus.SEARCHING]),
  [BookingStatus.EXPIRED]: new Set(),
  [BookingStatus.NO_BARBER_AVAILABLE]: new Set([BookingStatus.SEARCHING]),
  [BookingStatus.ADMIN_CANCELLED]: new Set(),
};

export const TERMINAL_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.COMPLETED,
  BookingStatus.CUSTOMER_CANCELLED,
  BookingStatus.ADMIN_CANCELLED,
  BookingStatus.EXPIRED,
]);

export const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.PENDING,
  BookingStatus.SEARCHING,
  BookingStatus.OFFERED,
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
]);

export const CANCELLABLE_BY_CUSTOMER_STATUSES = new Set<BookingStatus>([
  BookingStatus.SEARCHING,
  BookingStatus.OFFERED,
  BookingStatus.CONFIRMED,
]);
