import assert from './assert'
import type { EnvConfig } from '@harnessed-ts/core'
import {
  created,
  delayed,
  gqlData,
  gqlErrors,
  hang,
  json,
  mock,
  mockMatchers,
  networkError,
  notFound,
  problem,
  sse,
  toHar,
} from '@harnessed-ts/mock'
import type { ApiMock, MockOptions } from '@harnessed-ts/mock'
import { DataScreenHarness } from '../fixture/harnesses/DataScreen.harness'
import { UsersApi } from '../fixture/apis/users.api'
import { DataPage } from '../fixture/harnesses/pages/data.page'
import type { View } from './catalog'

/**
 * What the mock specs need from a runner: an env on the page the next `show()`
 * will load, so mocks can be in place before the view makes its first request.
 */
export interface MockCtx {
  env(): EnvConfig
  show(view: View): Promise<EnvConfig>
}

export interface MockSpec {
  name: string
  run(ctx: MockCtx): Promise<void>
}

/**
 * Scoped to the fixture's API, so the dev server's own requests (Vite's client,
 * HMR) are never policed. `/graphql` and `/socket` are the fixture's too.
 */
const SCOPE = ['/api/**', '/graphql']

function api(ctx: MockCtx, options?: MockOptions): ApiMock {
  return mock(ctx.env(), { scope: SCOPE, ...options })
}

async function screen(ctx: MockCtx): Promise<DataScreenHarness> {
  return new DataScreenHarness(await ctx.show('data'))
}

/** Polls `read` until `accept` holds — for state that changes after an interaction returns. */
async function eventually<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  timeout = 4_000,
): Promise<T> {
  const deadline = Date.now() + timeout
  let value = await read()
  while (!accept(value)) {
    if (Date.now() > deadline) throw new Error(`still ${JSON.stringify(value)} after ${timeout}ms`)
    await new Promise(resolve => setTimeout(resolve, 25))
    value = await read()
  }
  return value
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const ADA = json({ id: '1', name: 'Ada' })

const DELAY_MS = 600

/**
 * A delayed reply takes at least its delay to arrive, and while it is in flight
 * the view shows it loading. Some runners (TestCafe) wait for a page's requests
 * before an action returns, so the loading state is checked only when the view
 * came back before the reply was due.
 */
async function assertDelayed(ctx: MockCtx, name: string): Promise<void> {
  const start = Date.now()
  const data = await screen(ctx)
  if (Date.now() - start < DELAY_MS - 150) assert.equal(await data.isUserLoading(), true)
  assert.equal(await data.userName(), name)
  const elapsed = Date.now() - start
  assert.ok(
    elapsed >= DELAY_MS,
    `the reply arrived after ${elapsed}ms, before its ${DELAY_MS}ms delay`,
  )
}

/**
 * Mocking behaviour every driver shares: written once, run by every runner. As
 * with the main catalog there is no per-driver opt-out — where a runner cannot
 * do something (stream, open sockets), the spec asserts the documented
 * fallback instead of skipping.
 */
export const mockSpecs: MockSpec[] = [
  {
    name: 'mock: a request fired as the view loads is answered by a mock set before it',
    async run(ctx) {
      const mocks = api(ctx)
      const users = await mocks.get('/api/users/:id').reply(ADA)
      const data = await screen(ctx)
      assert.equal(await data.userName(), 'Ada')
      assert.equal(users.callCount, 1)
      mocks.verify()
    },
  },
  {
    name: 'mock: path params reach the handler, and the log records the call',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(({ params }) => json({ name: `user ${params.id}` }))
      const data = await screen(ctx)
      assert.equal(await data.userName(), 'user 1')
      const call = mocks.lastCall('GET /api/users/:id')
      assert.deepEqual(call?.params, { id: '1' })
      assert.equal(call?.status, 200)
    },
  },
  {
    name: 'mock: a status shortcut reaches the app as that status',
    async run(ctx) {
      await api(ctx).get('/api/users/:id').reply(notFound())
      assert.equal(await (await screen(ctx)).userError(), '404')
    },
  },
  {
    name: 'mock: problem details reach the app as problem+json',
    async run(ctx) {
      await api(ctx)
        .get('/api/users/:id')
        .reply(problem({ status: 403, title: 'Not allowed' }))
      assert.equal(await (await screen(ctx)).userError(), 'Not allowed')
    },
  },
  {
    name: 'mock: networkError() fails the request at the network level',
    async run(ctx) {
      await api(ctx).get('/api/users/:id').reply(networkError())
      assert.equal(await (await screen(ctx)).userError(), 'Network error')
    },
  },
  {
    name: 'mock: a delayed reply is in flight first, then arrives',
    async run(ctx) {
      await api(ctx).get('/api/users/:id').delay(DELAY_MS).reply(ADA)
      await assertDelayed(ctx, 'Ada')
    },
  },
  {
    name: 'mock: hang() never answers, until reset releases it',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(hang())
      const data = await screen(ctx)
      await sleep(400)
      assert.equal(await data.isUserLoading(), true)
      mocks.reset()
      assert.equal(await data.userError(), 'Network error')
    },
  },
  {
    name: 'mock: the newest handler wins, and .once() falls through when used',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(ADA)
      await mocks
        .get('/api/users/:id')
        .once()
        .reply(json({ name: 'Bo' }))
      const data = await screen(ctx)
      assert.equal(await data.userName(), 'Bo')
      await data.reloadUser()
      await eventually(
        () => data.userName(),
        name => name === 'Ada',
      )
    },
  },
  {
    name: 'mock: an unanswered request in scope is refused, and verify() names it',
    async run(ctx) {
      const mocks = api(ctx)
      // Nothing registered here awaits the install, so wait for it explicitly.
      await mocks.ready()
      const data = await screen(ctx)
      assert.equal(await data.userError(), 'Network error')
      assert.throws(() => mocks.verify(), /no mock answered GET \S*\/api\/users\/1/)
    },
  },
  {
    name: 'mock: a request outside scope is not policed',
    async run(ctx) {
      const mocks = api(ctx, { scope: '/api/todos' })
      await mocks.ready()
      await (await screen(ctx)).userError()
      mocks.verify()
    },
  },
  {
    name: 'mock: XHR is answered like fetch',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(ADA)
      await mocks.get('/api/todos').reply([{ title: 'Write specs' }, { title: 'Ship' }])
      const data = await screen(ctx)
      await data.loadTodos()
      assert.deepEqual(await data.todoTitles(), ['Write specs', 'Ship'])
      assert.equal(mocks.lastCall('/api/todos')?.method, 'GET')
    },
  },
  {
    name: 'mock: body, query and headers reach the handler, and waitFor resolves with the request',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(ADA)
      const search = await mocks.post('/api/search').reply(({ body, query, headers }) =>
        json({
          count:
            (body as { q: string }).q.length +
            (query['source'] === 'form' ? 10 : 0) +
            (headers['x-client'] === 'fixture' ? 100 : 0),
        }),
      )
      const data = await screen(ctx)
      await data.search('ada')
      assert.equal(await data.searchResult(), '113 results')
      const call = await mocks.waitFor('POST /api/search')
      assert.deepEqual(call.body, { q: 'ada' })
      assert.equal(
        (
          await mockMatchers.toHaveBeenRequestedWith(search, {
            body: { q: 'ada' },
            query: { source: 'form' },
          })
        ).pass,
        true,
      )
      assert.equal((await mockMatchers.toHaveBeenRequestedTimes(search, 1)).pass, true)
    },
  },
  {
    name: 'mock: withBody narrows which handler answers',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(ADA)
      await mocks.post('/api/search').reply(json({ count: 0 }))
      await mocks
        .post('/api/search')
        .withBody({ q: 'ada' })
        .reply(json({ count: 1 }))
      const data = await screen(ctx)
      await data.search('bob')
      assert.equal(await data.searchResult(), '0 results')
      await data.search('ada')
      await eventually(
        () => data.searchResult(),
        text => text === '1 results',
      )
    },
  },
  {
    name: 'mock: state persists across requests within a test',
    async run(ctx) {
      const mocks = api(ctx, { state: { searches: 0 } })
      await mocks.get('/api/users/:id').reply(ADA)
      await mocks
        .post('/api/search')
        .reply(({ state }) => json({ count: ++(state as { searches: number }).searches }))
      const data = await screen(ctx)
      await data.search('a')
      assert.equal(await data.searchResult(), '1 results')
      await data.search('b')
      await eventually(
        () => data.searchResult(),
        text => text === '2 results',
      )
      assert.deepEqual(mocks.state, { searches: 2 })
    },
  },
  {
    name: 'mock: GraphQL operations match by name, and errors reach the app',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(ADA)
      const profile = await mocks.graphql.query(
        'GetProfile',
        gqlData({ profile: { handle: '@ada' } }),
      )
      await mocks.graphql.query('SomethingElse', gqlErrors(['wrong operation']))
      const data = await screen(ctx)
      await data.loadProfile()
      assert.equal(await data.profileHandle(), '@ada')
      assert.equal(profile.lastCall?.body !== undefined, true)
      profile.remove()
      await mocks.graphql.operation(/Profile$/, gqlErrors(['Profile is private']))
      await data.loadProfile()
      assert.equal(await data.profileError(), 'Profile is private')
    },
  },
  {
    name: 'mock: an API harness answers its routes, and a test can override one',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.use(UsersApi)
      const data = await screen(ctx)
      assert.equal(await data.userName(), 'Ada Lovelace')
      await mocks.use(UsersApi, { byId: notFound() })
      await data.reloadUser()
      assert.equal(await data.userError(), '404')
    },
  },
  {
    name: "mock: useFor() installs a page's declared mocks, beneath the test's own",
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.useFor(DataPage)
      const page = new DataPage(await ctx.show('data'))
      assert.equal(await page.screen.userName(), 'Ada Lovelace')
      await mocks.get('/api/users/:id').reply(json({ name: 'Override' }))
      await page.screen.reloadUser()
      await eventually(
        () => page.screen.userName(),
        name => name === 'Override',
      )
    },
  },
  {
    name: 'mock: a streamed response delivers every event — in pieces where the runner can stream',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(ADA)
      await mocks.get('/api/feed').reply(sse(['first', 'second'], { interval: 800 }))
      const data = await screen(ctx)
      await data.openFeed()
      if (mocks.transport.capabilities.streaming) {
        assert.equal(await data.firstFeedEvent(), 'first')
        // The second piece is still 800ms away: a buffering transport would
        // have delivered both together.
        assert.equal(await data.feedEventCount(), 1)
      }
      assert.deepEqual(await data.feedEvents(), ['first', 'second'])
    },
  },
  {
    name: 'mock: a WebSocket connects to the mock, which echoes and pushes',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(ADA)
      if (!mocks.transport.capabilities.websockets) {
        // The documented gap: refused readably, never silently unmocked.
        assert.throws(() => mocks.ws('/socket'), /cannot mock WebSockets/)
        return
      }
      const socket = mocks.ws('/socket')
      socket.onMessage((message, connection) => connection.send(`echo:${String(message)}`))
      await mocks.ready()
      const data = await screen(ctx)
      await data.connectSocket()
      await data.sendPing()
      assert.deepEqual(await data.socketMessages(1), ['echo:ping'])
      socket.send('pushed')
      assert.deepEqual(await data.socketMessages(2), ['echo:ping', 'pushed'])
      assert.deepEqual(socket.received, ['ping'])
    },
  },
  {
    name: 'mock: a HAR recording replays',
    async run(ctx) {
      const mocks = api(ctx)
      const request = { method: 'GET', headers: {}, body: null }
      const har = toHar([
        {
          request: { ...request, url: 'http://recorded.test/api/users/1' },
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"name":"Recorded Ada"}',
          startedAt: 0,
          durationMs: 1,
        },
      ])
      // Recorded against another host; replayed on whatever serves the page.
      await mocks.fromHar(har, { anyOrigin: true })
      assert.equal(await (await screen(ctx)).userName(), 'Recorded Ada')
    },
  },
  {
    name: 'mock: offline() fails every request in scope, mocked or not',
    async run(ctx) {
      const mocks = api(ctx)
      await mocks.get('/api/users/:id').reply(ADA)
      mocks.offline()
      const data = await screen(ctx)
      assert.equal(await data.userError(), 'Network error')
      mocks.online()
      await data.reloadUser()
      await eventually(
        () => data.userName().catch(() => ''),
        name => name === 'Ada',
      )
    },
  },
  {
    name: 'mock: reset() clears handlers and restores the initial state',
    async run(ctx) {
      const mocks = api(ctx, { state: { n: 1 } })
      await mocks.get('/api/users/:id').reply(ADA)
      ;(mocks.state as { n: number }).n = 5
      mocks.reset()
      assert.deepEqual(mocks.state, { n: 1 })
      await (await screen(ctx)).userError()
      assert.throws(() => mocks.verify(), /no mock answered/)
    },
  },
  {
    name: 'mock: a reply built with delayed() waits the same as .delay()',
    async run(ctx) {
      await api(ctx)
        .get('/api/users/:id')
        .reply(delayed(created({ name: 'Late' }), DELAY_MS))
      await assertDelayed(ctx, 'Late')
    },
  },
]

/**
 * Mock behaviour that needs a driver that navigates: `goto()` installs a page's
 * declared mocks before the first request.
 */
export interface MockUrlCtx {
  env: EnvConfig
}

export interface MockUrlSpec {
  name: string
  run(ctx: MockUrlCtx): Promise<void>
}

export const mockUrlSpecs: MockUrlSpec[] = [
  {
    name: "mock: goto() installs a page's declared mocks before it navigates",
    async run({ env }) {
      mock(env, { scope: SCOPE })
      const page = new DataPage(env)
      await page.goto()
      assert.equal(await page.screen.userName(), 'Ada Lovelace')
    },
  },
  {
    name: "mock: a test's own handler beats the page's declared mock",
    async run({ env }) {
      await mock(env, { scope: SCOPE })
        .get('/api/users/:id')
        .reply(json({ name: 'Mine' }))
      const page = new DataPage(env)
      await page.goto()
      assert.equal(await page.screen.userName(), 'Mine')
    },
  },
]
