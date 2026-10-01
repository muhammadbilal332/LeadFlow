import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setupEnv.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    pool: 'forks',
  },
});
