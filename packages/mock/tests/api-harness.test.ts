import { afterEach, describe, expect, it } from 'vitest'
import {
  Api,
  ApiHarness,
  Delete,
  Get,
  json,
  mock,
  noContent,
  notFound,
  Post,
  serverError,
} from '../src'
import type { ApiMock, MockRequest } from '../src'
import { jsonOf, replyOf, send, testEnv } from './helpers'

interface User {
  id: string
  name: string
}
interface State {
  users: User[]
}

@Api({ base: '/api/users' })
class UsersApi extends ApiHarness<State> {
  @Get()
  list({ state }: MockRequest<Record<string, string>, State>) {
    return state.users
  }

  @Get('/:id')
  byId({ params, state }: MockRequest<{ id: string }, State>) {
    return state.users.find(user => user.id === params.id) ?? notFound()
  }

  @Post()
  create({ body, state }: MockRequest<Record<string, string>, State>) {
    const user = { id: String(state.users.length + 1), ...(body as object) } as User
    state.users.push(user)
    return json(user, { status: 201 })
  }

  @Delete('/:id')
  remove({ params, state }: MockRequest<{ id: string }, State>) {
    state.users = state.users.filter(user => user.id !== params.id)
    return noContent()
  }
}

class AdminUsersApi extends UsersApi {
  @Get('/admins')
  admins() {
    return [{ id: 'root', name: 'Root' }]
  }
}

let api: ApiMock<State>
afterEach(() => api.dispose())

describe('API harnesses', () => {
  it('route methods answer under the class base, with typed state', async () => {
    api = mock<State>(testEnv(), { state: { users: [{ id: '1', name: 'Ada' }] } })
    await api.use(UsersApi)
    expect(jsonOf(await send({ url: 'http://x/api/users' }))).toEqual([{ id: '1', name: 'Ada' }])
    expect(jsonOf(await send({ url: 'http://x/api/users/1' }))).toEqual({ id: '1', name: 'Ada' })
    expect(replyOf(await send({ url: 'http://x/api/users/2' })).status).toBe(404)
    const created = await send({
      method: 'POST',
      url: 'http://x/api/users',
      headers: { 'content-type': 'application/json' },
      body: '{"name":"Bo"}',
    })
    expect(jsonOf(created)).toEqual({ id: '2', name: 'Bo' })
    expect(api.state.users).toHaveLength(2)
    expect(api.calls()[0]!.handler).toBe('UsersApi.list')
  })

  it('overrides replace a route by method name', async () => {
    api = mock<State>(testEnv(), { state: { users: [] } })
    await api.use(UsersApi, { byId: () => serverError() })
    expect(replyOf(await send({ url: 'http://x/api/users/1' })).status).toBe(500)
  })

  it('subclasses inherit routes and base', async () => {
    api = mock<State>(testEnv(), { state: { users: [] } })
    await api.use(new AdminUsersApi())
    expect(jsonOf(await send({ url: 'http://x/api/users/admins' }))).toEqual([
      { id: 'root', name: 'Root' },
    ])
  })

  it('a test handler registered later beats a harness route', async () => {
    api = mock<State>(testEnv(), { state: { users: [] } })
    await api.use(UsersApi)
    await api.get('/api/users').reply(json(['override']))
    expect(jsonOf(await send({ url: 'http://x/api/users' }))).toEqual(['override'])
  })

  it('useDefaults() and page mocks sit beneath test handlers', async () => {
    api = mock<State>(testEnv(), { state: { users: [] } })
    await api.get('/api/users').reply(json(['mine']))
    class UsersPage {
      get mocks() {
        return [UsersApi]
      }
    }
    await api.useFor(UsersPage)
    await api.useFor(UsersPage)
    expect(jsonOf(await send({ url: 'http://x/api/users' }))).toEqual(['mine'])
    expect(replyOf(await send({ url: 'http://x/api/users/9' })).status).toBe(404)
  })
})
