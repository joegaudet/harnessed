import { afterEach, describe, expect, it, vi } from 'vitest'
import { harHandlers, json, mock, openApi, toHar } from '../src'
import type { ApiMock, OpenApiDocument } from '../src'
import { graphqlSchema } from '../src/graphql-schema'
import { jsonOf, replyOf, send, testEnv } from './helpers'

const doc: OpenApiDocument = {
  openapi: '3.1.0',
  servers: [{ url: 'https://api.example.com/v1' }],
  paths: {
    '/users/{id}': {
      get: {
        responses: {
          200: {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          404: { description: 'missing' },
        },
      },
    },
    '/users': {
      post: {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', minLength: 1 } },
              },
            },
          },
        },
        responses: {
          201: {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'name'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          age: { type: ['integer', 'null'] },
        },
      },
    },
  },
}

const UUID = '6f1c1f9e-3f4a-4b7e-9d43-2a0b7f3f1e11'
let api: ApiMock
afterEach(() => {
  vi.restoreAllMocks()
  return api.dispose().catch(() => {})
})

describe('OpenAPI validation', () => {
  it('accepts a reply that matches the document', async () => {
    api = mock(testEnv(), { openapi: doc })
    await api.get('/v1/users/:id').reply(json({ id: UUID, name: 'Ada', age: null }))
    await send({ url: 'https://api.example.com/v1/users/1' })
    expect(() => api.verify()).not.toThrow()
  })

  it('reports drift: bad types, extra fields, undocumented status, unknown path, invalid request', async () => {
    api = mock(testEnv(), { openapi: doc })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await api
      .get('/v1/users/:id')
      .reply(({ params }) =>
        params.id === '1' ? json({ id: 'nope', name: 1, extra: true }) : json({}, { status: 418 }),
      )
    await api.post('/v1/users').reply(json({ id: UUID, name: 'x' }, { status: 201 }))
    await api.get('/v1/teams').reply(json([]))
    await send({ url: 'https://api.example.com/v1/users/1' })
    await send({ url: 'https://api.example.com/v1/users/2' })
    await send({
      method: 'POST',
      url: 'https://api.example.com/v1/users',
      headers: { 'content-type': 'application/json' },
      body: '{"name":""}',
    })
    await send({ url: 'https://api.example.com/v1/teams' })
    let message = ''
    try {
      api.verify()
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/at \/id: is not a valid uuid/)
    expect(message).toMatch(/at \/name: expected string, got integer/)
    expect(message).toMatch(/unexpected property "extra"/)
    expect(message).toMatch(/status 418 is not documented/)
    expect(message).toMatch(/request body at \/name: shorter than 1/)
    expect(message).toMatch(/no operation in the OpenAPI document matches GET \/v1\/teams/)
  })

  it('openApi() is usable directly with options', async () => {
    api = mock(testEnv(), { validators: [openApi(doc, { strict: false, validate: 'responses' })] })
    await api.get('/v1/teams').reply(json([]))
    await send({ url: 'https://api.example.com/v1/teams' })
    expect(() => api.verify()).not.toThrow()
  })
})

describe('GraphQL schema validation', () => {
  const sdl = `type Query { user(id: ID!): User }  type User { id: ID!, age: Int, name: String! }`
  const post = (query: string, variables = {}) =>
    send({
      method: 'POST',
      url: 'http://x/graphql',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })

  it('passes a valid result, including aliases', async () => {
    api = mock(testEnv(), { validators: [graphqlSchema(sdl)] })
    await api.graphql.query('GetUser', json({ data: { me: { id: '1', name: 'Ada', age: 3 } } }))
    await post('query GetUser { me: user(id: "1") { id name age } }')
    expect(() => api.verify()).not.toThrow()
  })

  it('fails a result whose types or nullability are wrong, and an invalid operation', async () => {
    api = mock(testEnv(), { validators: [graphqlSchema(sdl)] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await api.graphql.query('GetUser', ({ graphql }) =>
      json({
        data: {
          user:
            graphql!.variables['id'] === '1'
              ? { id: '1', name: 'Ada', age: 'old' }
              : { id: '2', name: null },
        },
      }),
    )
    await post('query GetUser($id: ID!) { user(id: $id) { id name age } }', { id: '1' })
    await post('query GetUser($id: ID!) { user(id: $id) { id name } }', { id: '2' })
    await post('query GetUser { user(id: "1") { nope } }')
    expect(() => api.verify()).toThrow(
      /at user.age: Int cannot represent[\s\S]*Cannot return null for non-nullable field User.name[\s\S]*Cannot query field "nope"/,
    )
  })
})

describe('HAR', () => {
  it('round-trips exchanges and replays them in recorded order', async () => {
    const har = toHar([
      {
        request: { method: 'GET', url: 'https://x.test/api/n', headers: {}, body: null },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '1',
        startedAt: 0,
        durationMs: 1,
      },
      {
        request: { method: 'GET', url: 'https://x.test/api/n', headers: {}, body: null },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '2',
        startedAt: 1,
        durationMs: 1,
      },
      {
        request: { method: 'GET', url: 'https://x.test/logo.png', headers: {}, body: null },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'image/png' },
        body: new Uint8Array([137, 80]),
        startedAt: 2,
        durationMs: 1,
      },
    ])
    expect(har.log.entries[2]!.response.content.encoding).toBe('base64')
    api = mock(testEnv())
    await api.fromHar(har)
    expect(jsonOf(await send({ url: 'https://x.test/api/n' }))).toBe(1)
    expect(jsonOf(await send({ url: 'https://x.test/api/n' }))).toBe(2)
    expect(jsonOf(await send({ url: 'https://x.test/api/n' }))).toBe(2)
    expect(replyOf(await send({ url: 'https://x.test/logo.png' })).body).toEqual(
      new Uint8Array([137, 80]),
    )
    expect(harHandlers(har, { filter: url => url.includes('/api/') })).toHaveLength(2)
  })

  it('records observed exchanges through the dispatcher', async () => {
    api = mock(testEnv())
    const recording = await api.recordHar()
    const { currentDispatcher } = await import('./helpers')
    currentDispatcher().observe({
      request: { method: 'GET', url: 'https://x.test/a', headers: {}, body: null },
      status: 204,
      statusText: '',
      headers: {},
      body: null,
      startedAt: 0,
      durationMs: 0,
    })
    const har = await recording.stop()
    expect(har.log.entries.map(entry => entry.request.url)).toEqual(['https://x.test/a'])
  })
})
