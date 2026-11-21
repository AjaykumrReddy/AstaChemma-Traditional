import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Starts the Worker locally for the end-to-end tests (src/worker.test.ts).
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
