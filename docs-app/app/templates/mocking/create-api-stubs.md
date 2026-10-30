# Migrating from createApiStubs

`createApiStubs` from `@harnessed-ts/playwright` is deprecated, and is removed in
the next minor. It now runs on [`mock()`](mocking-apis.md), which works the same
way under every runner, so moving over changes no behaviour.

## Before

```ts
import { createApiStubs, pw } from '@harnessed-ts/playwright'

const api = createApiStubs({
  defaults: { orders: [] as Order[] },
  routes: {
    '/api/orders': stubs => stubs.orders,
  },
  live: () => process.env.LIVE_API === '1',
})
api.stubs.orders.push({ id: 'A-1', total: 42 })
await api.install(page)
```

## After

```ts
import { json, mock } from '@harnessed-ts/playwright/mock'
import { pw } from '@harnessed-ts/playwright'

if (process.env.LIVE_API !== '1') {
  const api = mock(pw(page), { state: { orders: [{ id: 'A-1', total: 42 }] as Order[] } })
  await api.get('/api/orders').reply(({ state }) => json(state.orders))
}
```

## What maps to what

| `createApiStubs`                    | `mock()`                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `defaults`, then mutating `stubs`   | the `state` option, which each handler receives                                               |
| `routes` keyed by a pathname suffix | one handler per route: `api.get(path)`, `api.post(path)`, with `:param` segments              |
| `pattern` (`'**/api/**'`)           | the `scope` option                                                                            |
| `fallback` (`{ ok: true }`)         | none: a request in scope that no handler answers fails the test, unless you set `onUnhandled` |
| `live`                              | skip the `mock()` call                                                                        |
| every response a `200` with JSON    | [builders](mocking-apis.md#builders) for any status, body, stream, delay or network failure   |

Unanswered requests failing the test is the one change you will notice. The
stubs answered anything under `/api/` with `{ ok: true }`, so a test could pass
while the app called an endpoint nobody had stubbed. To keep the old behaviour
while you migrate, pass `onUnhandled: 'bypass'` or `'warn'`.

For a `mocks` fixture that ends the mock after each test, wrap your `test` with
`withMocks(test)` from `@harnessed-ts/playwright/mock`.
