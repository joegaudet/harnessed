/**
 * API mocking under Playwright: `page.route` for HTTP, `page.routeWebSocket` for
 * sockets. Everything from `@harnessed-ts/mock`, with this driver's transport
 * registered.
 *
 * ```ts
 * import { json, mock } from '@harnessed-ts/playwright/mock'
 *
 * const api = mock(pw(page), { scope: '/api/**' })
 * await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id }))
 * await page.goto('/users/1')
 * ```
 */
import './mock-transport'
export * from '@harnessed-ts/mock'
