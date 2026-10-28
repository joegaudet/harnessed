import { Api, ApiHarness, Get, json, notFound } from '@harnessed-ts/mock'
import type { MockRequest } from '@harnessed-ts/mock'

/** The user endpoint the data screen loads on mount, as an API harness. */
@Api({ base: '/api/users' })
export class UsersApi extends ApiHarness {
  @Get('/:id')
  byId({ params }: MockRequest<{ id: string }>) {
    return params.id === '1' ? json({ id: '1', name: 'Ada Lovelace' }) : notFound()
  }
}
