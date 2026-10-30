import { HANDLER } from './handler'
import type { HandlerDefinition } from './handler'
import type { MockRequest, Responder } from './types'

const API = Symbol.for('harnessed.mock.api')
const ROUTES = Symbol.for('harnessed.mock.routes')

export interface ApiOptions {
  /** Prefix for every route on the class: a path (`/api/users`) or an absolute URL. */
  base?: string
}

interface RouteMeta {
  method: string
  path: string
  key: string
}

interface ApiCarrier {
  [API]?: ApiOptions
}

interface RouteCarrier {
  [ROUTES]?: RouteMeta[]
}

/**
 * Declares an API harness: a class per backend resource whose methods answer
 * its routes. Like `@Harness` for a component, it is reused across suites and
 * runners.
 *
 * ```ts
 * @Api({ base: '/api/users' })
 * class UsersApi extends ApiHarness<{ users: User[] }> {
 *   @Get('/:id') byId({ params, state }: MockRequest<{ id: string }, { users: User[] }>) {
 *     return state.users.find(user => user.id === params.id) ?? notFound()
 *   }
 * }
 * ```
 */
export function Api(options: ApiOptions = {}) {
  return function decorate<T extends abstract new (...args: never[]) => ApiHarness<unknown>>(
    target: T,
    _context: ClassDecoratorContext,
  ): T {
    // A static property: subclasses inherit it through the constructor chain,
    // and it is shared by an ESM and a CJS copy of this module.
    Object.defineProperty(target, API, { value: options, configurable: true })
    return target
  }
}

function route(method: string) {
  return function (path = '') {
    return function decorate<This extends ApiHarness<unknown>, Request>(
      _method: (this: This, request: Request) => unknown,
      context: ClassMethodDecoratorContext<This>,
    ): void {
      const key = String(context.name)
      context.addInitializer(function (this: This) {
        const carrier = this as unknown as RouteCarrier
        carrier[ROUTES] ??= []
        carrier[ROUTES].push({ method, path, key })
      })
    }
  }
}

export const Get = route('GET')
export const Post = route('POST')
export const Put = route('PUT')
export const Patch = route('PATCH')
export const Delete = route('DELETE')
export const Head = route('HEAD')
export const Options = route('OPTIONS')
/** Any method. */
export const All = route('*')

function join(base: string, path: string): string {
  if (path === '' || path === '/') return base === '' ? '/' : base
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

/** Per-route replacements, keyed by the method that declares the route. */
export type ApiOverrides<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? Responder<Record<string, string>, never>
    : never
}

/**
 * The base of every API harness. Subclass it, decorate the class with `@Api`
 * and its methods with `@Get`, `@Post` and friends, then `api.use(TheClass)`.
 *
 * A route method receives the parsed request, typed state included, and
 * returns what the handler would: a built reply or any value, sent as JSON.
 * Returning `undefined` falls through to the next handler.
 */
export abstract class ApiHarness<State = unknown> {
  /** Narrows `MockRequest`'s state for route method signatures. */
  declare protected readonly stateType: State

  /** Every route as a handler definition, with `overrides` replacing the named ones. */
  handlers(overrides?: ApiOverrides<this>): HandlerDefinition<State>[] {
    const options = (this.constructor as ApiCarrier)[API] ?? {}
    const routes = (this as unknown as RouteCarrier)[ROUTES] ?? []
    const replacements = (overrides ?? {}) as Record<
      string,
      Responder<Record<string, string>, State> | undefined
    >
    return routes.map(meta => {
      const replacement = replacements[meta.key]
      const own = (
        this as unknown as Record<
          string,
          (request: MockRequest<Record<string, string>, State>) => unknown
        >
      )[meta.key]!
      const respond: Responder<Record<string, string>, State> = replacement !== undefined
        ? replacement
        : (request: MockRequest<Record<string, string>, State>) => own.call(this, request)
      return {
        [HANDLER]: true,
        method: meta.method,
        pattern: join(options.base ?? '', meta.path),
        respond,
        name: `${this.constructor.name}.${meta.key}`,
      }
    })
  }
}

export type ApiHarnessConstructor<T extends ApiHarness<unknown> = ApiHarness<unknown>> = new () => T

export function isApiHarnessClass(value: unknown): value is ApiHarnessConstructor {
  return typeof value === 'function' && value.prototype instanceof ApiHarness
}
