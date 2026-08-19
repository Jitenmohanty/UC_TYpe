import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('Auth API Integration Tests', () => {
  const testUser = {
    name: 'John Test',
    email: 'john.test@example.com',
    phone: '+12345678901',
    password: 'Password123',
    role: 'CUSTOMER',
  };

  it('POST /api/v1/auth/register - should successfully register a new customer', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toHaveProperty('_id');
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('POST /api/v1/auth/register - should reject duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser);
    const res = await request(app).post('/api/v1/auth/register').send(testUser);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login - should log in registered user', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data).toHaveProperty('accessToken');
  });

  it('POST /api/v1/auth/login - should fail with wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword123',
    });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.success).toBe(false);
  });

  it('GET /api/v1/auth/me - should return profile for authenticated user', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(testUser);
    const token = regRes.body.data.accessToken;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBe(testUser.email);
  });

  it('GET /api/v1/auth/me - should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
