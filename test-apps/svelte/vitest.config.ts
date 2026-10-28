import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

/**
 * Parity and the dom driver's catalog, under jsdom, through @testing-library/svelte.
 * `svelteTesting()` resolves Svelte's browser build (`mount` does not exist in
 * the server one Node would otherwise get).
 */
export default defineConfig({
  // Must come before the framework plugin: Node cannot parse `accessor` fields.
  plugins: [harnessedDecorators(), svelte(), svelteTesting({ autoCleanup: false })],
  test: {
    environment: 'jsdom',
    include: ['tests/*.test.ts'],
    setupFiles: ['tests/setup.dom.ts'],
  },
})
