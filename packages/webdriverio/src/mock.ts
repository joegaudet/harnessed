/**
 * API mocking under WebdriverIO, over WebDriver BiDi: an agent injected before
 * the page's own scripts intercepts fetch, XHR and WebSockets. Everything from
 * `@harnessed-ts/mock`, with this driver's transport registered. Mocks apply
 * from the next page load.
 *
 * The browser outlives a test, so reset between tests — `afterEach(() =>
 * resetMocks())`, or `resetMocks()` in the config's `afterTest` hook.
 *
 * ```ts
 * import { json, mock } from '@harnessed-ts/webdriverio/mock'
 *
 * const api = mock(wdio(browser), { scope: '/api/**' })
 * await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id }))
 * await browser.url('/users/1')
 * ```
 */
import './mock-transport'
export * from '@harnessed-ts/mock'
