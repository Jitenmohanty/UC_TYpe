import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

let mongod: MongoMemoryServer;

// Setup in-memory MongoDB for all tests
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key]?.deleteMany({});
  }
});

// Mock Redis to avoid needing a real Redis in unit tests.
// Still needed: distributed locks, rate limiting and idempotency all use it.
vi.mock('../src/config/redis', () => ({
  getRedisClient: () => ({
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(3600),
    quit: vi.fn().mockResolvedValue('OK'),
    status: 'ready',
  }),
  getRedisStatus: () => 'ready',
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

// Twilio is optional at runtime; stub it so tests never attempt a real send.
vi.mock('../src/common/services/twilio.service', () => ({
  twilioService: {
    sendServiceOtpSms: vi.fn().mockResolvedValue(undefined),
    sendServiceStartedSms: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetOtpSms: vi.fn().mockResolvedValue(undefined),
  },
}));
