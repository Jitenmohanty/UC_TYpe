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

// Mock Redis to avoid needing a real Redis in unit tests
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
}));

// Mock BullMQ queues
vi.mock('../src/queues/allocation.queue', () => ({
  allocationQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
  },
}));

vi.mock('../src/queues/expiration.queue', () => ({
  expirationQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-exp-job-id' }),
  },
}));

vi.mock('../src/queues/notification.queue', () => ({
  notificationQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-notif-job-id' }),
  },
}));

// Mock socket server
vi.mock('../src/sockets/socket.server', () => ({
  emitToUser: vi.fn(),
  initializeSocketServer: vi.fn(),
  getSocketServer: vi.fn().mockReturnValue(null),
}));
