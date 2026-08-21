import axios from 'axios';
import type {
  AdminStats,
  Assignment,
  BarberProfile,
  Booking,
  Paginated,
  ServiceItem,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the bearer token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Force re-auth on 401 (expired/invalid token) — but not on 403 (role denied)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      const url: string = error?.config?.url || '';
      const isAuthFlow = [
        '/auth/login',
        '/auth/register',
        '/auth/forgot-password',
        '/auth/verify-reset-otp',
        '/auth/reset-password',
      ].some((path) => url.includes(path));

      if (!isAuthFlow) {
        localStorage.removeItem('accessToken');
        window.dispatchEvent(
          new CustomEvent('auth:required', {
            detail: { message: 'Your session has expired. Please sign in again.' },
          }),
        );
      }
    }
    return Promise.reject(error);
  },
);

/** Pull a human-readable message out of an axios error. */
export const apiErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: { message?: string }; message?: string } } };
  return e?.response?.data?.error?.message || e?.response?.data?.message || fallback;
};

/** Every list endpoint returns `{ data, total, ... }`. Normalise to an array. */
const rows = <T>(payload: Paginated<T> | T[] | null | undefined): T[] => {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: async (payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: string;
    location?: { latitude: number; longitude: number };
  }) => {
    const res = await api.post('/auth/register', payload);
    return res.data.data;
  },
  login: async (payload: { email: string; password: string }) => {
    const res = await api.post('/auth/login', payload);
    return res.data.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data.data;
  },
  forgotPassword: async (
    identifier: string,
  ): Promise<{ message: string; identifier?: string; expiresAt?: string }> => {
    const res = await api.post('/auth/forgot-password', { identifier });
    return res.data.data;
  },
  verifyResetOtp: async (
    identifier: string,
    otp: string,
  ): Promise<{ message: string; resetToken: string }> => {
    const res = await api.post('/auth/verify-reset-otp', { identifier, otp });
    return res.data.data;
  },
  resetPassword: async (
    resetToken: string,
    newPassword: string,
  ): Promise<{ message: string }> => {
    const res = await api.post('/auth/reset-password', { resetToken, newPassword });
    return res.data.data;
  },
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
};

// ─── Service catalog ──────────────────────────────────────────────────────────
export const servicesApi = {
  getAll: async (): Promise<ServiceItem[]> => {
    const res = await api.get('/services');
    return rows<ServiceItem>(res.data.data);
  },
};

// ─── Customer ─────────────────────────────────────────────────────────────────
export const customersApi = {
  getProfile: async () => {
    const res = await api.get('/customers/me');
    return res.data.data;
  },
  updateProfile: async (payload: { name?: string; phone?: string }) => {
    const res = await api.patch('/customers/me', payload);
    return res.data.data;
  },
  updateLocation: async (latitude: number, longitude: number) => {
    const res = await api.patch('/customers/me/location', { latitude, longitude });
    return res.data.data;
  },
};

// ─── Barber ───────────────────────────────────────────────────────────────────
export const barbersApi = {
  getNearby: async (params: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    serviceId?: string;
    date?: string;
    startTime?: string;
  }): Promise<BarberProfile[]> => {
    const res = await api.get('/barbers/nearby', { params });
    return rows<BarberProfile>(res.data.data);
  },

  getMe: async (): Promise<BarberProfile> => {
    const res = await api.get('/barbers/me');
    return res.data.data;
  },

  updateLocation: async (latitude: number, longitude: number): Promise<BarberProfile> => {
    const res = await api.patch('/barbers/me/location', { latitude, longitude });
    return res.data.data;
  },

  /** Availability switch — whether customers are shown this barber. */
  setAcceptingBookings: async (enabled: boolean): Promise<BarberProfile> => {
    const res = await api.patch('/barbers/me/auto-allocation', { enabled });
    return res.data.data;
  },

  /** The barber's one live job (offer or in flight), or null. */
  getActiveAssignment: async (): Promise<Assignment | null> => {
    const res = await api.get('/barbers/me/active-assignment');
    return res.data.data ?? null;
  },

  /** Job history for this barber. */
  getMyJobs: async (params?: { page?: number; limit?: number }): Promise<Assignment[]> => {
    const res = await api.get('/barbers/me/bookings', { params });
    return rows<Assignment>(res.data.data);
  },

  /** Bookings still waiting for a barber. */
  getOpenBookings: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<Paginated<Booking>> => {
    const res = await api.get('/barbers/pool/open-bookings', { params });
    return res.data.data;
  },

  /** Take an open booking for yourself. */
  claimBooking: async (bookingId: string): Promise<Assignment> => {
    const res = await api.post(`/barbers/pool/open-bookings/${bookingId}/claim`);
    return res.data.data;
  },
};

// ─── Booking (customer) ───────────────────────────────────────────────────────
export const bookingApi = {
  create: async (payload: {
    serviceId: string;
    scheduledDate: string;
    startTime: string;
    timezone?: string;
    barberPreference?: 'ANY' | 'SPECIFIC';
    preferredBarberId?: string;
    customerLocation: { latitude: number; longitude: number };
    addressSnapshot?: {
      formattedAddress?: string;
      houseNumber?: string;
      landmark?: string;
      postalCode?: string;
      contactPhone?: string;
      city?: string;
      state?: string;
      country?: string;
    };
  }): Promise<Booking> => {
    const res = await api.post('/bookings', payload);
    return res.data.data;
  },

  getMyBookings: async (): Promise<Booking[]> => {
    const res = await api.get('/bookings');
    return rows<Booking>(res.data.data);
  },

  getById: async (bookingId: string) => {
    const res = await api.get(`/bookings/${bookingId}`);
    return res.data.data;
  },

  cancel: async (bookingId: string, reason: string): Promise<Booking> => {
    const res = await api.post(`/bookings/${bookingId}/cancel`, { reason });
    return res.data.data;
  },

  getOtp: async (
    bookingId: string,
  ): Promise<{ otp: string; expiresAt: string; bookingId: string }> => {
    const res = await api.get(`/bookings/${bookingId}/otp`);
    return res.data.data;
  },

  resendOtp: async (
    bookingId: string,
  ): Promise<{ message: string; otp: string; expiresAt: string; bookingId: string }> => {
    const res = await api.post(`/bookings/${bookingId}/resend-otp`);
    return res.data.data;
  },

  /** Barber submits the customer's code to start the service. */
  verifyOtp: async (
    bookingId: string,
    otp: string,
  ): Promise<{ message: string; bookingId: string; status: string }> => {
    const res = await api.post(`/bookings/${bookingId}/verify-otp`, { otp });
    return res.data.data;
  },
};

// ─── Assignment lifecycle (barber) ────────────────────────────────────────────
export const assignmentApi = {
  getActive: async (): Promise<Assignment | null> => {
    const res = await api.get('/assignments/pending');
    return res.data.data ?? null;
  },
  accept: async (assignmentId: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/accept`);
    return res.data.data;
  },
  reject: async (assignmentId: string, reason?: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/reject`, { reason });
    return res.data.data;
  },
  startJourney: async (
    assignmentId: string,
  ): Promise<{ message: string; bookingId: string; status: string }> => {
    const res = await api.post(`/assignments/${assignmentId}/start-journey`);
    return res.data.data;
  },
  arrive: async (
    assignmentId: string,
  ): Promise<{ message: string; bookingId: string; status: string; otpExpiresAt: string }> => {
    const res = await api.post(`/assignments/${assignmentId}/arrive`);
    return res.data.data;
  },
  complete: async (assignmentId: string): Promise<{ message: string; bookingId: string }> => {
    const res = await api.post(`/assignments/${assignmentId}/complete`);
    return res.data.data;
  },
  cancel: async (assignmentId: string, reason: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/cancel`, { reason });
    return res.data.data;
  },
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: async (): Promise<AdminStats> => {
    const res = await api.get('/admin/stats');
    return res.data.data;
  },
  getBookings: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<Paginated<Booking>> => {
    const res = await api.get('/admin/bookings', { params });
    return res.data.data;
  },
  getBarbers: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<Paginated<BarberProfile>> => {
    const res = await api.get('/admin/barbers', { params });
    return res.data.data;
  },
  updateBarberStatus: async (
    barberId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ): Promise<BarberProfile> => {
    const res = await api.patch(`/admin/barbers/${barberId}/status`, { status });
    return res.data.data;
  },
  assignBarber: async (bookingId: string, barberId: string): Promise<{ assignment: Assignment }> => {
    const res = await api.post(`/admin/bookings/${bookingId}/assign`, { barberId });
    return res.data.data;
  },
  cancelBooking: async (bookingId: string, reason?: string) => {
    const res = await api.post(`/admin/bookings/${bookingId}/cancel`, { reason });
    return res.data.data;
  },
  getAuditLogs: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data.data;
  },
};
