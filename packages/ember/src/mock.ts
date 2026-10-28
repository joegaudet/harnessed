/**
 * API mocking in Ember's test runners: `fetch`, `XMLHttpRequest` and
 * `WebSocket` are patched in the test page through `@mswjs/interceptors`
 * (install it alongside). Everything from `@harnessed-ts/mock`, with this
 * driver's transport registered, plus `setupMocks(hooks)`.
 *
 * ```ts
 * import { json, mock, setupMocks } from '@harnessed-ts/ember/mock'
 *
 * module('Acceptance | profile', function (hooks) {
 *   setupApplicationTest(hooks)
 *   setupMocks(hooks)
 *
 *   test('shows the user', async function () {
 *     await mock(ember()).get('/api/users/:id').reply(json({ name: 'Ada' }))
 *     await visit('/profile')
 *   })
 * })
 * ```
 *
 * Installed on top of whatever patched `fetch` first — Mirage and Pretender
 * included — so a request no mock answers still reaches them, as long as the
 * mock's `scope` leaves it out or `onUnhandled` lets it through.
 */
import { registerMockTransport, resetMocks } from '@harnessed-ts/mock'
import { inPageTransport } from '@harnessed-ts/mock/in-page'
import { EMBER_DRIVER } from './driver-id'

registerMockTransport(EMBER_DRIVER, inPageTransport())

/** The slice of QUnit's `hooks` this needs. */
interface Hooks {
  afterEach(callback: () => void | Promise<void>): void
}

/**
 * Ends every mock after each test in the module, so no handler, state or
 * interception outlives its test — and fails the test if a request in scope went
 * unanswered or a handler threw. The `setupRenderingTest` of mocking.
 */
export function setupMocks(hooks: Hooks): void {
  hooks.afterEach(() => resetMocks())
}

export * from '@harnessed-ts/mock'
