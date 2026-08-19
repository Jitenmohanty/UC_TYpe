import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app';
import { generateTestAccessToken } from './integration.setup';
import { UserRole } from '../../src/common/constants/roles';
import { BarberProfileModel } from '../../src/modules/barbers/barberProfile.model';

const app = createApp();

describe('Barbers API Integration Tests', () => {
  it('GET /api/v1/barbers/nearby - Should return nearby barbers list', async () => {
    const res = await request(app)
      .get('/api/v1/barbers/nearby')
      .query({ latitude: 40.7128, longitude: -74.006 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/barbers/me - Barber should fetch own profile', async () => {
    const barberUserId = new mongoose.Types.ObjectId();

    // Seed barber profile in database
    await BarberProfileModel.create({
      userId: barberUserId,
      bio: 'Professional Barber',
      experienceYears: 5,
      autoAllocationEnabled: true,
      serviceRadiusKm: 10,
    });

    const barberToken = generateTestAccessToken(barberUserId, UserRole.BARBER);

    const res = await request(app)
      .get('/api/v1/barbers/me')
      .set('Authorization', `Bearer ${barberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bio).toBe('Professional Barber');
  });

  it('PATCH /api/v1/barbers/me/location - Should update barber location coordinates', async () => {
    const barberUserId = new mongoose.Types.ObjectId();

    await BarberProfileModel.create({
      userId: barberUserId,
      bio: 'Professional Barber',
      experienceYears: 5,
      autoAllocationEnabled: true,
      serviceRadiusKm: 10,
    });

    const barberToken = generateTestAccessToken(barberUserId, UserRole.BARBER);

    const res = await request(app)
      .patch('/api/v1/barbers/me/location')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 40.7128, longitude: -74.006 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentLocation.coordinates).toEqual([-74.006, 40.7128]);
  });
});
