import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// PURE business-logic modules: the 90% line-coverage threshold applies to these.
const PURE_MODULES = [
  'src/lib/format.js',
  'src/lib/dates.js',
  'src/lib/validate.js',
  'src/lib/access.js',
  'src/lib/planner.js',
  'src/lib/conflicts.js',
  'src/lib/utilisation.js',
];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Rules tests need the Firestore emulator and run separately.
    exclude: ['node_modules/**', 'dist/**', 'tests/rules/**'],
    coverage: {
      provider: 'v8',
      include: PURE_MODULES,
      reporter: ['text', 'html'],
      thresholds: { lines: 90 },
    },
  },
});
