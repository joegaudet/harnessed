import { http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { mock, text } from '../src'
import type { ApiMock } from '../src'
import { jsonOf, replyOf, send, testEnv } from './helpers'

let api: ApiMock
afterEach(() => api.dispose())

describe('MSW interop', () => {
  it('runs MSW handlers, and falls through when they do not apply', async () => {
    api = mock(testEnv(), { onUnhandled: 'bypass' })
    await api.get('/api/other').reply(text('ours'))
    await api.useMsw([
      mswHttp.get('/api/users/:id', ({ params }) =>
        HttpResponse.json({ id: params['id'] }, { status: 203 }),
      ),
      mswHttp.post('/api/down', () => HttpResponse.error()),
    ])
    const user = await send({ url: 'http://localhost/api/users/5' })
    expect(replyOf(user).status).toBe(203)
    expect(jsonOf(user)).toEqual({ id: '5' })
    expect(await send({ method: 'POST', url: 'http://localhost/api/down' })).toEqual({
      kind: 'error',
      fault: 'network-error',
    })
    expect(replyOf(await send({ url: 'http://localhost/api/other' })).body).toBe('ours')
  })
})
