export type UserRole = 'CUSTOMER' | 'BARBER' | 'ADMIN';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
}

/**
 * Shape the API returns for every paginated list endpoint.
 *
 * The backend's `buildPaginatedResult` puts the rows under `data` — the
 * dashboards previously read a non-existent `items` key, which is why the
 * booking and barber tables silently rendered empty.
 */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface BarberProfile {
  _id: string;
  userId: string;
  bio?: string;
  experienceYears: number;
  rating: number;
  totalReviews: number;
  totalCompletedJobs: number;
  totalAccepted?: number;
  totalOffered?: number;
  totalRejected?: number;
  totalCancellations?: number;
  /** Availability switch: is this barber offered to customers? */
  autoAllocationEnabled: boolean;
  serviceRadiusKm: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL';
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationUpdatedAt?: string;
  distanceKm?: number;
  user?: User;
}

export interface ServiceItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  categoryId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  imageUrl?: string;
}

export type BookingStatus =
  | 'PENDING'
  | 'OFFERED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CUSTOMER_CANCELLED'
  | 'BARBER_CANCELLED'
  | 'ADMIN_CANCELLED'
  | 'EXPIRED'
  // Legacy — only on rows created by the removed auto-allocation engine.
  | 'SEARCHING'
  | 'NO_BARBER_AVAILABLE';

export type AssignmentStatus =
  | 'OFFERED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED_BY_BARBER'
  | 'CANCELLED_BY_CUSTOMER'
  | 'EXPIRED';

export type AssignmentSource = 'BARBER_CLAIM' | 'ADMIN_ASSIGN' | 'CUSTOMER_CHOICE';

/** Booking statuses that sit in the open pool, waiting for a barber. */
export const UNASSIGNED_STATUSES: BookingStatus[] = [
  'PENDING',
  'BARBER_CANCELLED',
  'SEARCHING',
  'NO_BARBER_AVAILABLE',
];

export const ACTIVE_STATUSES: BookingStatus[] = [
  'PENDING',
  'OFFERED',
  'CONFIRMED',
  'IN_PROGRESS',
  'SEARCHING',
];

export const CANCELLED_STATUSES: BookingStatus[] = [
  'CUSTOMER_CANCELLED',
  'BARBER_CANCELLED',
  'ADMIN_CANCELLED',
  'EXPIRED',
  'NO_BARBER_AVAILABLE',
];

export interface AddressSnapshot {
  formattedAddress?: string;
  houseNumber?: string;
  landmark?: string;
  postalCode?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface Booking {
  _id: string;
  bookingNumber: string;
  customerId: string | User;
  serviceId: string | ServiceItem;
  serviceSnapshot: {
    name: string;
    price: number;
    durationMinutes: number;
    categoryId?: string;
  };
  addressSnapshot?: AddressSnapshot;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  customerLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
}

export interface Assignment {
  _id: string;
  bookingId: string | Booking;
  barberId: string;
  status: AssignmentStatus;
  source?: AssignmentSource;
  cancellationReason?: string;
  offeredAt?: string;
  acceptedAt?: string;
  enRouteAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface AdminStats {
  totalBookings: number;
  completedBookings: number;
  awaitingAssignment: number;
  inProgress: number;
  confirmed: number;
  completedRevenue: number;
  completionRate: number;
  totalBarbers: number;
  byStatus: Record<string, number>;
}
