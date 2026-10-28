/**
 * API mocking under TestCafe, through a request hook on the test's controller.
 * Everything from `@harnessed-ts/mock`, with this driver's transport
 * registered. Streaming and WebSockets are not available under TestCafe.
 *
 * ```ts
 * import { json, mock } from '@harnessed-ts/testcafe/mock'
 *
 * test('shows the user', async t => {
 *   const api = mock(testcafe(t), { scope: '/api/**' })
 *   await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id }))
 *   await t.navigateTo('/users/1')
 * })
 * ```
 */
import './mock-transport'
export * from '@harnessed-ts/mock'
