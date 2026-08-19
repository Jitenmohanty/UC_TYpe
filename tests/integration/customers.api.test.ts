import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app';
import { generateTestAccessToken } from './integration.setup';
import { UserRole } from '../../src/common/constants/roles';
import { UserModel } from '../../src/modules/users/user.model';

const app = createApp();

describe('Customers API Integration Tests', () => {
  it('GET /api/v1/customers/me - Should fetch customer profile', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UserModel.create({
      _id: userId,
      name: 'Customer Test',
      email: 'customer@example.com',
      phone: '+19998887777',
      passwordHash: 'hashed',
      role: UserRole.CUSTOMER,
    });

    const token = generateTestAccessToken(userId, UserRole.CUSTOMER, 'customer@example.com');

    const res = await request(app)
      .get('/api/v1/customers/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Customer Test');
  });

  it('PATCH /api/v1/customers/me - Should update customer profile name', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UserModel.create({
      _id: userId,
      name: 'Customer Test',
      email: 'customer2@example.com',
      phone: '+19998887778',
      passwordHash: 'hashed',
      role: UserRole.CUSTOMER,
    });

    const token = generateTestAccessToken(userId, UserRole.CUSTOMER, 'customer2@example.com');

    const res = await request(app)
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('PATCH /api/v1/customers/me/location - Should update customer coordinates', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UserModel.create({
      _id: userId,
      name: 'Customer Test',
      email: 'customer3@example.com',
      phone: '+19998887779',
      passwordHash: 'hashed',
      role: UserRole.CUSTOMER,
    });

    const token = generateTestAccessToken(userId, UserRole.CUSTOMER, 'customer3@example.com');

    const res = await request(app)
      .patch('/api/v1/customers/me/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 37.7749, longitude: -122.4194 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location.coordinates).toEqual([-122.4194, 37.7749]);
  });
});
