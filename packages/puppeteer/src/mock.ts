/**
 * API mocking under Puppeteer: request interception for HTTP, a page shim for
 * WebSockets. Everything from `@harnessed-ts/mock`, with this driver's
 * transport registered.
 *
 * ```ts
 * import { json, mock } from '@harnessed-ts/puppeteer/mock'
 *
 * const api = mock(puppeteer(page), { scope: '/api/**' })
 * await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id }))
 * await page.goto(url)
 * ```
 */
import './mock-transport'
export * from '@harnessed-ts/mock'
