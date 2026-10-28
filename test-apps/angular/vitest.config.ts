import { defineConfig } from 'vitest/config'
import { plugins } from './vite.shared.ts'

/** The fixture-parity check and the catalog under jsdom, through TestBed. */
export default defineConfig({
  plugins: plugins('tsconfig.spec.json'),
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
