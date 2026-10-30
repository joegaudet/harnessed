import { Api, ApiHarness, defineFactory, Get, json, notFound, Post, seq } from '@harnessed-ts/mock'
import type { MockRequest } from '@harnessed-ts/mock'

/**
 * Test data for one resource: deterministic, so a failure reproduces. Overrides
 * win over the defaults: `users.build({ name: 'Bo' })`, `users.buildList(3)`.
 */
export interface Thing {
  id: string
  name: string
}
export const things = defineFactory<Thing>({ id: seq(String), name: seq(n => `Thing ${n}`) })

/** What the routes share across one test: cloned fresh for every test. */
export interface ThingState {
  things: Thing[]
}

/**
 * The backend for one resource, as an API harness: a class per resource, its
 * routes named for what they answer. A test uses it with
 * `await mock(env, { scope: '/api/**', state: { things: [] } }).use(ThingsApi)`,
 * and overrides one route by method name: `use(ThingsApi, { byId: () => serverError() })`.
 * A page that always needs it declares it: `get mocks() { return [ThingsApi] }`.
 */
@Api({ base: '/api/things' })
export class ThingsApi extends ApiHarness<ThingState> {
  @Get()
  list({ state }: MockRequest<Record<string, string>, ThingState>) {
    return json(state.things)
  }

  @Get('/:id')
  byId({ params, state }: MockRequest<{ id: string }, ThingState>) {
    return state.things.find(thing => thing.id === params.id) ?? notFound()
  }

  @Post()
  create({ body, state }: MockRequest<Record<string, string>, ThingState>) {
    const thing = things.build(body as Partial<Thing>)
    state.things.push(thing)
    return json(thing, { status: 201 })
  }
}
