export const SocketEvents = {
  // Customer namespace
  BOOKING_CREATED: 'booking:created',
  BOOKING_SEARCHING: 'booking:searching',
  BOOKING_ASSIGNED: 'booking:assigned',
  BOOKING_CONFIRMED: 'booking:confirmed',
  BOOKING_CANCELLED: 'booking:cancelled',
  BOOKING_COMPLETED: 'booking:completed',

  // OTP verification
  OTP_GENERATED: 'otp:generated',
  OTP_VERIFIED: 'otp:verified',
  SERVICE_STARTED: 'service:started',

  // Barber namespace
  ASSIGNMENT_NEW: 'assignment:new',
  ASSIGNMENT_EXPIRED: 'assignment:expired',
  ASSIGNMENT_CANCELLED: 'assignment:cancelled',
} as const;

export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];
