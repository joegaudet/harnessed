import { harnessedDecorators } from '@harnessed-ts/core/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

/** Parity and the dom driver's catalog, under jsdom, through @testing-library/vue. */
export default defineConfig({
  // Must come before the framework plugin: Node cannot parse `accessor` fields.
  plugins: [harnessedDecorators(), vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/*.test.ts'],
    setupFiles: ['tests/setup.dom.ts'],
  },
})
