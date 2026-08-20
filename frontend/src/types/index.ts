export type UserRole = 'CUSTOMER' | 'BARBER' | 'ADMIN';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface BarberProfile {
  _id: string;
  userId: string;
  bio?: string;
  experienceYears: number;
  rating: number;
  totalReviews: number;
  totalCompletedJobs: number;
  autoAllocationEnabled: boolean;
  serviceRadiusKm: number;
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
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
  | 'SEARCHING'
  | 'OFFERED'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CUSTOMER_CANCELLED'
  | 'BARBER_CANCELLED'
  | 'EXPIRED'
  | 'NO_BARBER_AVAILABLE'
  | 'ADMIN_CANCELLED'
  | 'SYSTEM_CANCELLED';

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
  customer?: User;
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
  status: 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED_BY_CUSTOMER' | 'CANCELLED_BY_BARBER';
  cancellationReason?: string;
  offeredAt: string;
  expiresAt: string;
}
