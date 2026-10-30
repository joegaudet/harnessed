// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hang,
  json,
  mock,
  networkError,
  registerMockTransport,
  resetMocks,
  sse,
  text,
} from '../src'
import { inPageTransport } from '../src/in-page'

registerMockTransport('in-page-test', inPageTransport())
const env = { driver: 'in-page-test' }

afterEach(async () => {
  vi.restoreAllMocks()
  await resetMocks()
})

function xhr(
  method: string,
  url: string,
  body?: string,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, url)
    request.setRequestHeader('content-type', 'application/json')
    request.onload = () => resolve({ status: request.status, text: request.responseText })
    request.onerror = () => reject(new Error('xhr failed'))
    request.send(body)
  })
}

describe('in-page transport', () => {
  it('answers fetch', async () => {
    const api = mock(env, { scope: '/api/**' })
    await api
      .get('/api/users/:id')
      .reply(({ params }) => json({ id: params.id }, { headers: { 'x-from': 'mock' } }))
    const response = await fetch('http://localhost/api/users/4')
    expect(response.status).toBe(200)
    expect(response.headers.get('x-from')).toBe('mock')
    expect(await response.json()).toEqual({ id: '4' })
    expect(api.lastCall()).toMatchObject({
      method: 'GET',
      handler: 'GET /api/users/:id',
      status: 200,
    })
  })

  it('answers XHR, with the parsed body in the log', async () => {
    const api = mock(env)
    const orders = await api.post('/api/orders').reply(json({ id: 1 }, { status: 201 }))
    const result = await xhr('POST', 'http://localhost/api/orders', '{"sku":"A1"}')
    expect(result).toEqual({ status: 201, text: '{"id":1}' })
    expect(orders.lastCall?.body).toEqual({ sku: 'A1' })
  })

  it('fails a network error the way fetch does', async () => {
    const api = mock(env)
    await api.get('/api/down').reply(networkError())
    await expect(fetch('http://localhost/api/down')).rejects.toThrow(TypeError)
  })

  it('refuses an unhandled request in scope', async () => {
    mock(env, { scope: '/api/**' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetch('http://localhost/api/missing')).rejects.toThrow()
    await expect(resetMocks()).rejects.toThrow(
      /no mock answered GET http:\/\/localhost\/api\/missing/,
    )
  })

  it('streams chunks as they are produced', async () => {
    const api = mock(env)
    await api.get('/api/feed').reply(sse(['one', 'two'], { interval: 60 }))
    const response = await fetch('http://localhost/api/feed')
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    const start = Date.now()
    const first = decoder.decode((await reader.read()).value)
    const firstAt = Date.now() - start
    const second = decoder.decode((await reader.read()).value)
    const secondAt = Date.now() - start
    expect(first).toBe('data: one\n\n')
    expect(second).toBe('data: two\n\n')
    expect(secondAt - firstAt).toBeGreaterThanOrEqual(40)
  })

  it('mocks a WebSocket', async () => {
    const api = mock(env)
    const live = api.ws('ws://localhost/live')
    live.onMessage((data, socket) => socket.send(`echo:${String(data)}`))
    await api.ready()
    await new Promise(resolve => setTimeout(resolve, 0))
    const socket = new WebSocket('ws://localhost/live')
    const messages: string[] = []
    socket.addEventListener('message', event => messages.push(String(event.data)))
    await new Promise(resolve => socket.addEventListener('open', resolve))
    socket.send('hi')
    await vi.waitFor(() => expect(messages).toEqual(['echo:hi']))
    live.send('pushed')
    await vi.waitFor(() => expect(messages).toEqual(['echo:hi', 'pushed']))
    expect(live.received).toEqual(['hi'])
    socket.close()
  })

  it('passes through a request out of scope with no handler', async () => {
    const api = mock(env, { scope: '/api/**' })
    await api.get('/api/x').reply(text('x'))
    // Nothing listens on this port: a pass-through fails for real, which is the point.
    await expect(fetch('http://127.0.0.1:9/elsewhere')).rejects.toThrow()
    expect(() => api.verify()).not.toThrow()
  })
})

describe('in-page transport: hang', () => {
  it('releases a hung request on reset, as a failure', async () => {
    const api = mock(env)
    await api.get('/api/forever').reply(hang())
    const settled = fetch('http://localhost/api/forever').then(
      () => 'resolved',
      () => 'rejected',
    )
    await new Promise(resolve => setTimeout(resolve, 50))
    api.reset()
    expect(await settled).toBe('rejected')
  })
})
