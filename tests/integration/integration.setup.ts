import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer, MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import { getRedisClient, disconnectRedis } from '../../src/config/redis';
import { env } from '../../src/config/env';
import { UserRole } from '../../src/common/constants/roles';

let mongoServer: MongoMemoryServer | MongoMemoryReplSet | null = null;

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  const isContainerized = uri && !uri.includes('127.0.0.1') && !uri.includes('localhost');

  if (isContainerized) {
    await connectDatabase();
  } else {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongoServer.getUri());
  }

  // Ensure indexes (including 2dsphere) are created for all models
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.createIndexes())
  );

  try {
    const redis = getRedisClient();
    await redis.ping();
  } catch (err) {
    // Graceful fallback if Redis is not running locally
  }
});

afterEach(async () => {
  // Clear database collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key]?.deleteMany({});
  }

  // Clear redis cache if connected
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.flushdb();
    }
  } catch (err) {
    // Ignore Redis errors during test cleanup
  }
});

afterAll(async () => {
  await disconnectDatabase();
  await disconnectRedis();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

export function generateTestAccessToken(
  userId: string | mongoose.Types.ObjectId,
  role: UserRole = UserRole.CUSTOMER,
  email = 'test@example.com',
): string {
  return jwt.sign(
    {
      userId: userId.toString(),
      role,
      email,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' },
  );
}
