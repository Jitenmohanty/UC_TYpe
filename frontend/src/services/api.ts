import axios from 'axios';
import type { BarberProfile, ServiceItem, Booking, Assignment } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to add Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses to handle 401 / expired token and trigger login automatically
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Don't loop on login/register endpoints
      const url = error?.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/forgot-password') && !url.includes('/auth/verify-reset-otp') && !url.includes('/auth/reset-password')) {
        localStorage.removeItem('accessToken');
        window.dispatchEvent(new CustomEvent('auth:required', {
          detail: { message: 'Please sign in to proceed with your booking.' }
        }));
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
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
  forgotPassword: async (identifier: string): Promise<{ message: string; identifier?: string; expiresAt?: string }> => {
    const res = await api.post('/auth/forgot-password', { identifier });
    return res.data.data;
  },
  verifyResetOtp: async (identifier: string, otp: string): Promise<{ message: string; resetToken: string }> => {
    const res = await api.post('/auth/verify-reset-otp', { identifier, otp });
    return res.data.data;
  },
  resetPassword: async (resetToken: string, newPassword: string): Promise<{ message: string }> => {
    const res = await api.post('/auth/reset-password', { resetToken, newPassword });
    return res.data.data;
  },
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
};

// Service Catalog API
export const servicesApi = {
  getAll: async (): Promise<ServiceItem[]> => {
    const res = await api.get('/services');
    return res.data.data;
  },
};

// Customer API
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
export const barbersApi = {
  getNearby: async (params: { latitude: number; longitude: number; radiusKm?: number }): Promise<BarberProfile[]> => {
    const res = await api.get('/barbers/nearby', { params });
    return res.data.data;
  },
  getMe: async (): Promise<BarberProfile> => {
    const res = await api.get('/barbers/me');
    return res.data.data;
  },
  updateLocation: async (latitude: number, longitude: number): Promise<BarberProfile> => {
    const res = await api.patch('/barbers/me/location', { latitude, longitude });
    return res.data.data;
  },
  toggleAutoAllocation: async (enabled: boolean): Promise<BarberProfile> => {
    const res = await api.patch('/barbers/me/auto-allocation', { enabled });
    return res.data.data;
  },
};

// Booking API
export const bookingApi = {
  create: async (payload: {
    serviceId: string;
    scheduledDate: string;
    startTime: string;
    timezone?: string;
    barberPreference?: 'ANY' | 'SPECIFIC';
    preferredBarberId?: string;
    customerLocation: { latitude: number; longitude: number };
  }): Promise<Booking> => {
    const res = await api.post('/bookings', payload);
    return res.data.data;
  },
  getMyBookings: async (): Promise<Booking[]> => {
    const res = await api.get('/bookings');
    return res.data.data;
  },
  getById: async (bookingId: string) => {
    const res = await api.get(`/bookings/${bookingId}`);
    return res.data.data;
  },
  cancel: async (bookingId: string, reason: string): Promise<Booking> => {
    const res = await api.post(`/bookings/${bookingId}/cancel`, { reason });
    return res.data.data;
  },
  getOtp: async (bookingId: string): Promise<{ otp: string; expiresAt: string; bookingId: string }> => {
    const res = await api.get(`/bookings/${bookingId}/otp`);
    return res.data.data;
  },
  resendOtp: async (bookingId: string): Promise<{ message: string; otp: string; expiresAt: string; bookingId: string }> => {
    const res = await api.post(`/bookings/${bookingId}/resend-otp`);
    return res.data.data;
  },
  verifyOtp: async (bookingId: string, otp: string): Promise<{ message: string; bookingId: string; status: string }> => {
    const res = await api.post(`/bookings/${bookingId}/verify-otp`, { otp });
    return res.data.data;
  },
};

// Assignment API (for Barber Portal)
export const assignmentApi = {
  getPending: async (): Promise<Assignment | null> => {
    const res = await api.get('/assignments/pending');
    return res.data.data;
  },
  accept: async (assignmentId: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/accept`);
    return res.data.data;
  },
  reject: async (assignmentId: string, reason?: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/reject`, { reason });
    return res.data.data;
  },
  startJourney: async (assignmentId: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/start-journey`);
    return res.data.data;
  },
  arrive: async (assignmentId: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/arrive`);
    return res.data.data;
  },
  startService: async (assignmentId: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/start-service`);
    return res.data.data;
  },
  complete: async (assignmentId: string): Promise<Assignment> => {
    const res = await api.post(`/assignments/${assignmentId}/complete`);
    return res.data.data;
  },
};

// Admin API
export const adminApi = {
  getBookings: async (params?: { page?: number; limit?: number; status?: string }) => {
    const res = await api.get('/admin/bookings', { params });
    return res.data.data;
  },
  getBarbers: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get('/admin/barbers', { params });
    return res.data.data;
  },
  updateBarberStatus: async (barberId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => {
    const res = await api.patch(`/admin/barbers/${barberId}/status`, { status });
    return res.data.data;
  },
  manualAssign: async (bookingId: string, barberId: string) => {
    const res = await api.post(`/admin/bookings/${bookingId}/assign`, { barberId });
    return res.data.data;
  },
  reallocate: async (bookingId: string) => {
    const res = await api.post(`/admin/bookings/${bookingId}/reallocate`);
    return res.data.data;
  },
  cancelBooking: async (bookingId: string, reason?: string) => {
    const res = await api.post(`/admin/bookings/${bookingId}/cancel`, { reason });
    return res.data.data;
  },
  getAllocationFailures: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get('/admin/allocation-failures', { params });
    return res.data.data;
  },
  getAuditLogs: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data.data;
  },
};
