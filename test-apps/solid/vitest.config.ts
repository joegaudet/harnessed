import { harnessedDecorators } from '@harnessed-ts/core/vite'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

/**
 * Parity and the dom driver's catalog, under jsdom, through @solidjs/testing-library.
 *
 * vite-plugin-solid adds `@testing-library/jest-dom/vitest` to the setup files
 * whenever it can resolve it from its own install, which in this workspace it
 * can. That is why jest-dom (the plugin's optional peer) is a devDependency
 * here although no test uses its matchers.
 */
export default defineConfig({
  // Must come before the framework plugin: Node cannot parse `accessor` fields.
  plugins: [harnessedDecorators(), solid()],
  test: {
    environment: 'jsdom',
    include: ['tests/*.test.tsx'],
    setupFiles: ['tests/setup.dom.ts'],
  },
})
