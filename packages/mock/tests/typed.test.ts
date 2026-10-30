import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import { mock, typedApi } from '../src'
import type { ApiMock } from '../src'
import { jsonOf, send, testEnv } from './helpers'

/** The shape openapi-typescript generates, for a two-operation API. */
interface paths {
  '/users/{id}': {
    get: {
      parameters: { path: { id: number } }
      responses: { 200: { content: { 'application/json': { id: string; name: string } } } }
    }
  }
  '/users': {
    post: {
      requestBody: { content: { 'application/json': { name: string } } }
      responses: { 201: { content: { 'application/json': { id: string; name: string } } } }
    }
  }
}

let api: ApiMock
afterEach(() => api.dispose())

describe('typedApi', () => {
  it('prefixes the server path and matches {param} segments', async () => {
    api = mock(testEnv())
    const typed = typedApi<paths>(api, { base: '/v1' })
    await typed.get('/users/{id}').reply(({ params }) => ({ id: params.id, name: 'Ada' }))
    expect(jsonOf(await send({ url: 'http://x/v1/users/7' }))).toEqual({ id: '7', name: 'Ada' })
  })

  it('types paths, params, request bodies and replies from the document', () => {
    api = mock(testEnv())
    const typed = typedApi<paths>(api)
    void typed.get('/users/{id}').reply(({ params }) => {
      // Params arrive from a URL, so they are strings whatever the schema says.
      expectTypeOf(params).toEqualTypeOf<{ id: string }>()
      return { id: params.id, name: 'Ada' }
    })
    void typed.post('/users').reply(({ body }) => {
      expectTypeOf(body).toEqualTypeOf<{ name: string }>()
      return { id: '1', name: body.name }
    })
    // @ts-expect-error — no such path in the document
    void typed.get('/teams')
    // @ts-expect-error — GET is not declared on /users
    void typed.get('/users')
    // @ts-expect-error — the reply is missing `name`
    void typed.get('/users/{id}').reply({ id: '1' })
  })
})
