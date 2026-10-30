/**
 * API mocking under Vitest browser mode: `fetch`, `XMLHttpRequest` and
 * `WebSocket` are patched in the test page through `@mswjs/interceptors`
 * (install it alongside), whichever provider runs the browser. Everything from
 * `@harnessed-ts/mock`, with this driver's transport registered.
 *
 * The page outlives a test, so reset between tests —
 * `@harnessed-ts/mock/vitest` as a setup file does it.
 *
 * ```ts
 * import { json, mock } from '@harnessed-ts/vitest-browser/mock'
 *
 * const api = mock(vitestBrowser(), { scope: '/api/**' })
 * await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id }))
 * render(<UserCard id="1" />)
 * ```
 */
import { registerMockTransport } from '@harnessed-ts/mock'
import { inPageTransport } from '@harnessed-ts/mock/in-page'
import { VITEST_BROWSER_DRIVER } from './driver-id'

registerMockTransport(VITEST_BROWSER_DRIVER, inPageTransport())

export * from '@harnessed-ts/mock'
