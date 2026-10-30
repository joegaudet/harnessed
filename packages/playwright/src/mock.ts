/**
 * API mocking under Playwright: `page.route` for HTTP, `page.routeWebSocket` for
 * sockets. Everything from `@harnessed-ts/mock`, with this driver's transport
 * registered, and `withMocks` for a `mocks` fixture.
 *
 * ```ts
 * import { json, mock } from '@harnessed-ts/playwright/mock'
 *
 * const api = mock(pw(page), { scope: '/api/**' })
 * await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id }))
 * await page.goto('/users/1')
 * ```
 */
import { mock, resetMocks } from '@harnessed-ts/mock'
import type { ApiMock } from '@harnessed-ts/mock'
import type { Page, TestType } from '@playwright/test'
import { pw } from './env'
import './mock-transport'

export * from '@harnessed-ts/mock'

/** The fixture `withMocks` adds. */
export interface MocksFixture {
  mocks: ApiMock
}

/**
 * The base test type with a `mocks` fixture added, keeping the base's own —
 * written as a conditional for the same reason `withWorld`'s is.
 */
export type WithMocks<T> =
  T extends TestType<infer TestArgs, infer WorkerArgs>
    ? TestType<TestArgs & MocksFixture, WorkerArgs>
    : never

type AnyTestType = TestType<{ page: Page }, Record<string, unknown>>

/**
 * Adds a `mocks` fixture — the mock for the test's `page` — to any
 * Playwright-shaped `test`, plain or playwright-bdd's. It is ended after the
 * test, failing it if a request in scope went unanswered.
 *
 * ```ts
 * export const test = withMocks(base)
 * test('shows the user', async ({ page, mocks }) => {
 *   await mocks.get('/api/users/:id').reply(json({ name: 'Ada' }))
 *   await page.goto('/users/1')
 * })
 * ```
 */
export function withMocks<T>(base: T): WithMocks<T> {
  const extended = (base as unknown as AnyTestType).extend<MocksFixture>({
    mocks: async ({ page }: { page: Page }, use: (value: ApiMock) => Promise<void>) => {
      await use(mock(pw(page)))
      await resetMocks()
    },
  })
  return extended as unknown as WithMocks<T>
}
