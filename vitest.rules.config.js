import { defineConfig } from 'vitest/config';

// Firestore security rules tests: Node environment, run against the emulator via
// `npm run emulator:rules` (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
