/**
 * A Vitest setup file that resets every mock after each test, reporting any
 * unanswered request or failed handler as that test's failure:
 *
 * ```ts
 * // vitest.config.ts
 * test: { setupFiles: ['@harnessed-ts/mock/vitest'] }
 * ```
 */
import { afterEach } from 'vitest'
import { resetMocks } from './api-mock'

afterEach(() => {
  resetMocks()
})
