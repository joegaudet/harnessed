/**
 * API mocking under Testing Library: `fetch`, `XMLHttpRequest` and `WebSocket`
 * are patched in jsdom through `@mswjs/interceptors` (install it alongside).
 * Everything from `@harnessed-ts/mock`, with this driver's transport registered.
 *
 * The window outlives a test, so reset between tests — `@harnessed-ts/mock/vitest`
 * as a setup file does it, or `afterEach(() => resetMocks())`.
 *
 * ```ts
 * import { json, mock } from '@harnessed-ts/dom/mock'
 *
 * const api = mock(dom({ user }), { scope: '/api/**' })
 * await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id }))
 * render(<UserCard id="1" />)
 * ```
 */
import { registerMockTransport } from '@harnessed-ts/mock'
import { inPageTransport } from '@harnessed-ts/mock/in-page'
import { DOM_DRIVER } from './driver-id'

registerMockTransport(DOM_DRIVER, inPageTransport())

export * from '@harnessed-ts/mock'
