import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/helpers/setupEnv.js'],
    hookTimeout: 120000,
    testTimeout: 20000,
    fileParallelism: false,
    coverage: {
      include: ['src/**'],
      exclude: ['src/server.js', 'src/gateway/razorpayGateway.js'],
    },
  },
});
