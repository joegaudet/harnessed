import { afterEach, describe, expect, it, vi } from 'vitest'
import { configure, resetConfig } from '@harnessed-ts/core'
import {
  created,
  hang,
  json,
  mock,
  mockMatchers,
  networkError,
  passthrough,
  resetMocks,
  text,
} from '../src'
import type { ApiMock, MockOptions } from '../src'
import { currentDispatcher, disposed, jsonOf, replyOf, send, testEnv } from './helpers'

let api: ApiMock

function fresh(options?: MockOptions): ApiMock {
  api = mock(testEnv(), options)
  return api
}

afterEach(async () => {
  vi.restoreAllMocks()
  resetConfig()
  await api?.dispose().catch(() => {})
})

describe('ApiMock', () => {
  it('returns the same mock for the same network and merges options', () => {
    const env = testEnv()
    const a = mock(env, { latency: 1 })
    const b = mock({ ...env }, { scope: '/api/**' })
    expect(a).toBe(b)
    api = a
  })

  it('answers with the newest matching handler', async () => {
    fresh()
    await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id, from: 'first' }))
    await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id, from: 'second' }))
    expect(jsonOf(await send({ url: 'http://app.test/api/users/7' }))).toEqual({
      id: '7',
      from: 'second',
    })
  })

  it('sends plain values as JSON, and undefined falls through', async () => {
    fresh()
    await api.get('/api/me').reply({ name: 'Ada' })
    await api.get('/api/me').reply(() => undefined)
    const reply = replyOf(await send({ url: 'http://x/api/me' }))
    expect(reply.headers['content-type']).toBe('application/json')
    expect(JSON.parse(reply.body as string)).toEqual({ name: 'Ada' })
  })

  it('.once() answers one request, then falls through', async () => {
    fresh()
    await api.get('/api/flag').reply(text('always'))
    const once = await api.get('/api/flag').once().reply(text('first'))
    expect(replyOf(await send({ url: 'http://x/api/flag' })).body).toBe('first')
    expect(replyOf(await send({ url: 'http://x/api/flag' })).body).toBe('always')
    expect(once.remaining).toBe(0)
    expect(once.callCount).toBe(1)
  })

  it('matches on method, query, headers, body and predicates', async () => {
    fresh()
    await api.post('/api/search').withQuery({ page: '2' }).reply(text('page 2'))
    await api.post('/api/search').withHeaders({ 'X-Mode': /fast/ }).reply(text('fast'))
    await api
      .post('/api/search')
      .withBody({ filter: { tag: 'a' } })
      .reply(text('tag a'))
    await api
      .post('/api/search')
      .where(({ query }) => query['q'] === 'z')
      .reply(text('z'))
    const post = (extra: object) => send({ method: 'POST', url: 'http://x/api/search', ...extra })
    expect(replyOf(await post({ url: 'http://x/api/search?page=2' })).body).toBe('page 2')
    expect(replyOf(await post({ headers: { 'x-mode': 'very-fast' } })).body).toBe('fast')
    expect(
      replyOf(
        await post({
          headers: { 'content-type': 'application/json' },
          body: '{"filter":{"tag":"a","x":1}}',
        }),
      ).body,
    ).toBe('tag a')
    expect(replyOf(await post({ url: 'http://x/api/search?q=z' })).body).toBe('z')
  })

  it('passes a Standard Schema body check, and types the body', async () => {
    fresh()
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        // What Zod and friends declare, so the body is typed by the schema.
        types: undefined as unknown as { input: unknown; output: { n: number } },
        validate: (value: unknown) =>
          typeof (value as { n?: unknown })?.n === 'number'
            ? { value: value as { n: number } }
            : { issues: [{ message: 'n must be a number', path: ['n'] }] },
      },
    }
    await api
      .post('/api/n')
      .withBody(schema)
      .reply(({ body }) => json({ doubled: body.n * 2 }))
    const ok = await send({
      method: 'POST',
      url: 'http://x/api/n',
      headers: { 'content-type': 'application/json' },
      body: '{"n":2}',
    })
    expect(jsonOf(ok)).toEqual({ doubled: 4 })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = await send({
      method: 'POST',
      url: 'http://x/api/n',
      headers: { 'content-type': 'application/json' },
      body: '{"n":"2"}',
    })
    expect(bad).toEqual({ kind: 'error', fault: 'network-error' })
    expect(() => api.verify()).toThrow(/no mock answered POST/)
  })

  it('refuses an unanswered request in scope, names the candidates, and verify() reports it', async () => {
    fresh({ scope: '/api/**' })
    await api.get('/api/users').reply([])
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await send({ url: 'http://x/api/orders' })).toEqual({
      kind: 'error',
      fault: 'network-error',
    })
    expect(error.mock.calls[0]![0]).toMatch(
      /no mock answered GET http:\/\/x\/api\/orders[\s\S]*GET \/api\/users/,
    )
    expect(await send({ url: 'http://x/static/app.js' })).toEqual({ kind: 'passthrough' })
    expect(() => api.verify()).toThrow(/no mock answered/)
    expect(() => api.verify()).not.toThrow()
  })

  it('polices only fetch and XHR when no scope is set', async () => {
    fresh()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await send({ url: 'http://x/logo.png', kind: 'other' })).toEqual({ kind: 'passthrough' })
    expect((await send({ url: 'http://x/anything', kind: 'xhr' })).kind).toBe('error')
    api.reset = api.reset.bind(api)
    expect(() => api.reset()).toThrow()
  })

  it('onUnhandled: warn and bypass pass through; a function decides', async () => {
    fresh({ onUnhandled: 'warn' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await send({ url: 'http://x/api/a' })).toEqual({ kind: 'passthrough' })
    expect(warn).toHaveBeenCalledOnce()
    api.configure({ onUnhandled: 'bypass' })
    expect(await send({ url: 'http://x/api/a' })).toEqual({ kind: 'passthrough' })
    api.configure({
      onUnhandled: (request, decide) =>
        request.url.includes('bad') ? decide.error() : decide.passthrough(),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await send({ url: 'http://x/api/bad' })).kind).toBe('error')
    expect(() => api.verify()).toThrow()
  })

  it('keeps a log, with parsed bodies, per route and overall', async () => {
    fresh()
    const orders = await api.post('/api/orders').reply(created({ id: 1 }))
    await send({
      method: 'POST',
      url: 'http://x/api/orders?src=web',
      headers: { 'Content-Type': 'application/json' },
      body: '{"sku":"A1"}',
    })
    expect(orders.lastCall).toMatchObject({
      method: 'POST',
      body: { sku: 'A1' },
      query: { src: 'web' },
      status: 201,
    })
    expect(api.calls('POST /api/orders')).toHaveLength(1)
    expect(api.calls('GET /api/orders')).toHaveLength(0)
    expect((await mockMatchers.toHaveBeenRequestedWith(orders, { body: { sku: 'A1' } })).pass).toBe(
      true,
    )
    expect((await mockMatchers.toHaveBeenRequestedTimes(orders, 2)).message()).toMatch(
      /2 time\(s\), but it was 1/,
    )
  })

  it('waitFor resolves with an earlier request, then waits for the next', async () => {
    fresh()
    await api.post('/api/ping').reply(text('pong'))
    await send({ method: 'POST', url: 'http://x/api/ping' })
    const first = await api.waitFor('POST /api/ping')
    expect(first.url).toBe('http://x/api/ping')
    const next = api.waitFor('/api/ping')
    await send({ method: 'POST', url: 'http://x/api/ping?n=2' })
    expect((await next).query).toEqual({ n: '2' })
  })

  it('waitFor times out with the harness timeout and lists what was seen', async () => {
    fresh()
    configure({ defaultTimeout: 50 })
    await expect(api.waitFor('/api/never')).rejects.toThrow(
      /timed out after 50ms waiting for \/api\/never\. No requests were made/,
    )
  })

  it('state is cloned per mock and per reset', async () => {
    const initial = { count: 0 }
    fresh({ state: initial })
    await api
      .post('/api/inc')
      .reply(({ state }) => json({ count: ++(state as typeof initial).count }))
    await send({ method: 'POST', url: 'http://x/api/inc' })
    expect(jsonOf(await send({ method: 'POST', url: 'http://x/api/inc' }))).toEqual({ count: 2 })
    expect(initial.count).toBe(0)
    api.reset()
    expect(api.state).toEqual({ count: 0 })
  })

  it('applies latency and per-handler delay', async () => {
    fresh({ latency: 20 })
    await api.get('/api/slow').delay(30).reply(text('ok'))
    const start = Date.now()
    await send({ url: 'http://x/api/slow' })
    expect(Date.now() - start).toBeGreaterThanOrEqual(45)
  })

  it('faults: network error, passthrough, and hang until reset', async () => {
    fresh()
    await api.get('/api/down').reply(networkError())
    await api.get('/api/real').reply(passthrough())
    await api.get('/api/forever').reply(hang())
    expect(await send({ url: 'http://x/api/down' })).toEqual({
      kind: 'error',
      fault: 'network-error',
    })
    expect(await send({ url: 'http://x/api/real' })).toEqual({ kind: 'passthrough' })
    const pending = send({ url: 'http://x/api/forever' })
    let settled = false
    void pending.then(() => (settled = true))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(settled).toBe(false)
    api.reset()
    expect(await pending).toEqual({ kind: 'error', fault: 'abort' })
  })

  it('offline() fails every request in scope, mocked or not', async () => {
    fresh()
    await api.get('/api/x').reply(text('x'))
    api.offline()
    expect(await send({ url: 'http://x/api/x' })).toEqual({ kind: 'error', fault: 'network-error' })
    api.online()
    expect(replyOf(await send({ url: 'http://x/api/x' })).body).toBe('x')
  })

  it('a handler that throws answers 500 and fails verify()', async () => {
    fresh()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await api.get('/api/boom').reply(() => {
      throw new Error('kaput')
    })
    expect(replyOf(await send({ url: 'http://x/api/boom' })).status).toBe(500)
    expect(() => api.verify()).toThrow(/threw while answering GET http:\/\/x\/api\/boom/)
  })

  it('returns(schema) validates replies', async () => {
    fresh()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: (value: unknown) =>
          typeof (value as { id?: unknown }).id === 'string'
            ? { value }
            : { issues: [{ message: 'id must be a string', path: ['id'] }] },
      },
    }
    await api
      .get('/api/u')
      .returns(schema)
      .reply(json({ id: 1 }))
    await send({ url: 'http://x/api/u' })
    expect(() => api.verify()).toThrow(/reply: id: id must be a string/)
  })

  it('remove() unregisters a route', async () => {
    fresh({ onUnhandled: 'bypass' })
    const route = await api.get('/api/x').reply(text('x'))
    route.remove()
    expect(await send({ url: 'http://x/api/x' })).toEqual({ kind: 'passthrough' })
  })

  it('reset() clears handlers but keeps intercepting', async () => {
    fresh({ onUnhandled: 'bypass' })
    await api.get('/api/x').reply(text('x'))
    await send({ url: 'http://x/api/x' })
    api.reset()
    expect(api.calls()).toHaveLength(0)
    expect(await send({ url: 'http://x/api/x' })).toEqual({ kind: 'passthrough' })
    // An unanswered request is still logged, with no handler.
    expect(api.calls()).toMatchObject([{ url: 'http://x/api/x', handler: undefined }])
  })

  it('resetMocks() ends every live mock, and the next mock(env) starts afresh', async () => {
    const env = testEnv()
    const first = mock(env, { latency: 5 })
    await first.get('/api/x').reply(text('x'))
    const before = disposed.length
    await resetMocks()
    expect(disposed.length).toBe(before + 1)
    const second = mock(env)
    expect(second).not.toBe(first)
    await second.ready()
    expect(await send({ url: 'http://x/api/x' })).toMatchObject({ kind: 'error' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api = second
    expect(() => second.verify()).toThrow(/No handlers are registered/)
  })

  it('resetMocks() reports what a mock left unverified', async () => {
    fresh()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await send({ url: 'http://x/api/unanswered' })
    await expect(resetMocks()).rejects.toThrow(/no mock answered GET http:\/\/x\/api\/unanswered/)
  })

  it('reads file() replies from disk', async () => {
    fresh()
    const { file } = await import('../src')
    await api.get('/download').reply(file(new URL('../package.json', import.meta.url)))
    const reply = replyOf(await send({ url: 'http://x/download' }))
    expect(reply.headers['content-type']).toBe('application/json')
    expect(reply.headers['content-disposition']).toBe('attachment; filename="package.json"')
    expect(new TextDecoder().decode(reply.body as Uint8Array)).toContain('@harnessed-ts/mock')
  })

  it('graphql handlers match by operation name and type', async () => {
    fresh()
    await api.graphql.query('GetUser', ({ graphql }) =>
      json({ data: { user: { id: graphql!.variables['id'] } } }),
    )
    await api.graphql.mutation('GetUser', json({ data: 'wrong type' }))
    const body = JSON.stringify({
      query: 'query GetUser($id: ID!) { user(id: $id) { id } }',
      variables: { id: '3' },
    })
    const result = await send({
      method: 'POST',
      url: 'http://x/graphql',
      headers: { 'content-type': 'application/json' },
      body,
    })
    expect(jsonOf(result)).toEqual({ data: { user: { id: '3' } } })
    const get = await send({
      url: `http://x/graphql?query=${encodeURIComponent('query GetUser { user { id } }')}`,
    })
    expect(jsonOf(get)).toEqual({ data: { user: {} } })
  })

  it('reports the dispatcher to WebSocket routes', async () => {
    fresh()
    const live = api.ws('wss://feed.test/live')
    live.onMessage((data, socket) => socket.send(`echo:${String(data)}`))
    const sent: unknown[] = []
    await api.ready()
    const target = currentDispatcher().connect('wss://feed.test/live')!
    target.open({ send: data => sent.push(data), close: () => {} })
    target.message('hi')
    live.send({ type: 'tick' })
    expect(sent).toEqual(['echo:hi', '{"type":"tick"}'])
    expect(await live.waitForMessage(data => data === 'hi')).toBe('hi')
    expect(currentDispatcher().connect('wss://other.test/')).toBeUndefined()
  })
})
