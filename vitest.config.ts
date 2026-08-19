import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.types.ts', 'src/**/*.d.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
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
