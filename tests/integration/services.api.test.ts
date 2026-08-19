import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app';
import { generateTestAccessToken } from './integration.setup';
import { UserRole } from '../../src/common/constants/roles';

const app = createApp();

describe('Services API Integration Tests', () => {
  const adminToken = generateTestAccessToken(new mongoose.Types.ObjectId(), UserRole.ADMIN);
  const customerToken = generateTestAccessToken(new mongoose.Types.ObjectId(), UserRole.CUSTOMER);

  const sampleService = {
    name: 'Haircut & Styling',
    description: 'Professional haircut and styling session for all hair types.',
    price: 45.0,
    durationMinutes: 45,
  };

  it('POST /api/v1/services - Admin should create a new service', async () => {
    const res = await request(app)
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(sampleService);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(sampleService.name);
    expect(res.body.data.price).toBe(45.0);
  });

  it('POST /api/v1/services - Customer should be forbidden (403)', async () => {
    const res = await request(app)
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(sampleService);

    expect(res.status).toBe(403);
  });

  it('GET /api/v1/services - Should list active services publicly', async () => {
    await request(app)
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(sampleService);

    const res = await request(app).get('/api/v1/services');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/services/:id - Should get service by ID', async () => {
    const created = await request(app)
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(sampleService);

    const serviceId = created.body.data._id;
    const res = await request(app).get(`/api/v1/services/${serviceId}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(serviceId);
  });

  it('PATCH /api/v1/services/:id - Admin should update service', async () => {
    const created = await request(app)
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(sampleService);

    const serviceId = created.body.data._id;
    const res = await request(app)
      .patch(`/api/v1/services/${serviceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 55.0 });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(55.0);
  });
});
