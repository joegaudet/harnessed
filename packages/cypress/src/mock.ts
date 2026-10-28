/**
 * API mocking under Cypress. Import it from the support file, next to
 * `@harnessed-ts/cypress/support`:
 *
 * ```ts
 * import '@harnessed-ts/cypress/support'
 * import '@harnessed-ts/cypress/mock'
 * ```
 *
 * It registers one `cy.intercept` before every test that hands requests to the
 * live mock, resets mocks after every test, and adds `cy.mock`. Everything from
 * `@harnessed-ts/mock` is re-exported.
 *
 * ```ts
 * cy.mock(api => api.get('/api/users/:id').reply(({ params }) => json({ id: params.id })))
 * cy.visit('/users/1')
 * ```
 */
import { mock } from '@harnessed-ts/mock'
import type { ApiMock } from '@harnessed-ts/mock'
import { cypress } from './env'
import type { CypressEnv } from './env'
import { registerMockHooks } from './mock-transport'

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Runs `fn` with the mock for the application under test, after awaiting
       * whatever it returns, and yields the mock.
       */
      mock(fn?: (api: ApiMock, env: CypressEnv) => unknown): Chainable<ApiMock>
    }
  }
}

registerMockHooks()

Cypress.Commands.add('mock', (fn?: (api: ApiMock, env: CypressEnv) => unknown) =>
  cy.window({ log: false }).then(async window => {
    const env = cypress({ window })
    const api = mock(env)
    await fn?.(api, env)
    await api.ready()
    return api
  }),
)

export * from '@harnessed-ts/mock'
