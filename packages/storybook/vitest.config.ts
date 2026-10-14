import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Node cannot parse `accessor` fields without it.
  plugins: [harnessedDecorators()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
