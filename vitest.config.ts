import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

// Vitest configuration. Unit tests (sim-core, state, utils) run in the fast `node`
// environment; component tests (*.test.tsx) opt into jsdom for the DOM + RTL.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // sim-core and state hold the testable logic; target >= 90% (see CLAUDE.md).
      include: ['src/sim-core/**', 'src/state/**'],
      reportsDirectory: './coverage',
    },
  },
})
