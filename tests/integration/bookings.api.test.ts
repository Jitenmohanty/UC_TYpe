import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app';
import { generateTestAccessToken } from './integration.setup';
import { UserRole, ServiceStatus } from '../../src/common/constants/roles';
import { BookingStatus } from '../../src/common/constants/bookingStates';
import { ServiceModel } from '../../src/modules/services/service.model';
import { UserModel } from '../../src/modules/users/user.model';
import { BookingModel } from '../../src/modules/bookings/booking.model';

const app = createApp();

describe('Bookings API Integration Tests', () => {
  it('POST /api/v1/bookings - Should create booking successfully', async () => {
    const customerId = new mongoose.Types.ObjectId();
    await UserModel.create({
      _id: customerId,
      name: 'Booking Customer',
      email: 'buser@example.com',
      phone: '+18887776666',
      passwordHash: 'hash',
      role: UserRole.CUSTOMER,
    });

    const service = await ServiceModel.create({
      name: 'Beard Trim',
      description: 'Quick beard trimming and shaping service',
      price: 25.0,
      durationMinutes: 30,
      status: ServiceStatus.ACTIVE,
    });

    const token = generateTestAccessToken(customerId, UserRole.CUSTOMER, 'buser@example.com');

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        scheduledDate: '2026-10-15',
        startTime: '14:00',
        timezone: 'UTC',
        barberPreference: 'ANY',
        customerLocation: {
          latitude: 40.7128,
          longitude: -74.006,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(BookingStatus.SEARCHING);
  });

  it('GET /api/v1/bookings - Should list customer bookings', async () => {
    const customerId = new mongoose.Types.ObjectId();
    await UserModel.create({
      _id: customerId,
      name: 'Booking Customer 2',
      email: 'buser2@example.com',
      phone: '+18887776667',
      passwordHash: 'hash',
      role: UserRole.CUSTOMER,
    });

    const service = await ServiceModel.create({
      name: 'Classic Cut',
      description: 'Classic hair cut',
      price: 30.0,
      durationMinutes: 30,
      status: ServiceStatus.ACTIVE,
    });

    await BookingModel.create({
      bookingNumber: 'BK-TEST-001',
      customerId,
      serviceId: service._id,
      serviceSnapshot: {
        name: service.name,
        price: service.price,
        durationMinutes: service.durationMinutes,
      },
      scheduledDate: '2026-10-15',
      startTime: '15:00',
      endTime: '15:30',
      scheduledStart: new Date('2026-10-15T15:00:00Z'),
      scheduledEnd: new Date('2026-10-15T15:30:00Z'),
      durationMinutes: 30,
      totalPrice: 30.0,
      status: BookingStatus.SEARCHING,
      customerLocation: { type: 'Point', coordinates: [-74.006, 40.7128] },
    });

    const token = generateTestAccessToken(customerId, UserRole.CUSTOMER, 'buser2@example.com');

    const res = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it('POST /api/v1/bookings/:id/cancel - Customer should cancel pending booking', async () => {
    const customerId = new mongoose.Types.ObjectId();
    await UserModel.create({
      _id: customerId,
      name: 'Booking Customer 3',
      email: 'buser3@example.com',
      phone: '+18887776668',
      passwordHash: 'hash',
      role: UserRole.CUSTOMER,
    });

    const service = await ServiceModel.create({
      name: 'Hair Color',
      description: 'Full hair coloring',
      price: 80.0,
      durationMinutes: 60,
      status: ServiceStatus.ACTIVE,
    });

    const booking = await BookingModel.create({
      bookingNumber: 'BK-TEST-002',
      customerId,
      serviceId: service._id,
      serviceSnapshot: {
        name: service.name,
        price: service.price,
        durationMinutes: service.durationMinutes,
      },
      scheduledDate: '2026-10-15',
      startTime: '16:00',
      endTime: '17:00',
      scheduledStart: new Date('2026-10-15T16:00:00Z'),
      scheduledEnd: new Date('2026-10-15T17:00:00Z'),
      durationMinutes: 60,
      totalPrice: 80.0,
      status: BookingStatus.SEARCHING,
      customerLocation: { type: 'Point', coordinates: [-74.006, 40.7128] },
    });

    const token = generateTestAccessToken(customerId, UserRole.CUSTOMER, 'buser3@example.com');

    const res = await request(app)
      .post(`/api/v1/bookings/${booking._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Changed plans' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(BookingStatus.CUSTOMER_CANCELLED);
  });
});
