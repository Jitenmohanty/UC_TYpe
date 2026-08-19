import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('Health API Integration Tests', () => {
  it('GET /api/v1/health should return 200 and ok status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /api/v1/ready should return DB and Redis readiness status', async () => {
    const res = await request(app).get('/api/v1/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('redis');
  });
});
