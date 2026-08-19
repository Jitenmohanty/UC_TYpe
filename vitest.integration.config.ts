import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salon_booking_test',
      REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      JWT_ACCESS_SECRET: 'test_jwt_access_secret_key_32_characters_long_min',
      JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_key_32_characters_long_min',
      LOG_LEVEL: 'fatal',
    },
    setupFiles: ['./tests/integration/integration.setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@config': path.resolve(__dirname, './src/config'),
      '@common': path.resolve(__dirname, './src/common'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@workers': path.resolve(__dirname, './src/workers'),
      '@queues': path.resolve(__dirname, './src/queues'),
      '@sockets': path.resolve(__dirname, './src/sockets'),
      '@audit': path.resolve(__dirname, './src/audit'),
    },
  },
});
