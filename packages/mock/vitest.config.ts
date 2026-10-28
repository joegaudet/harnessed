import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [harnessedDecorators()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
