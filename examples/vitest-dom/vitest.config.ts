import { harnessedDecorators } from '@harnessed-ts/core/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Must come before the framework plugin: Node cannot parse `accessor` fields.
  plugins: [harnessedDecorators(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/setup.ts'],
  },
})
