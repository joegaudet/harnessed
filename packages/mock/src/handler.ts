import { isStandardSchema, standardIssues } from './schema'
import type { InferOutput, StandardSchemaV1 } from './schema'
import { compilePattern } from './url-pattern'
import type { CompiledPattern, PathParams, UrlPattern } from './url-pattern'
import type { HandlerResult, MockRequest, RecordedCall, ReplyValue, Responder } from './types'

/** Brands a handler definition, so `api.use()` tells one from an overrides object. */
export const HANDLER: unique symbol = Symbol.for('harnessed.mock.handler') as never

export type RequestPredicate = (request: MockRequest) => boolean | Promise<boolean>

export interface GraphQLMatch {
  readonly type: 'query' | 'mutation' | 'operation'
  readonly name: string | RegExp | undefined
}

/**
 * A handler as data: what it matches and how it answers. Portable — the same
 * definition can be handed to any number of mocks, under any runner.
 */
export interface HandlerDefinition<State = unknown> {
  readonly [HANDLER]: true
  readonly method: string
  readonly pattern: UrlPattern
  readonly respond: Responder<Record<string, string>, State>
  readonly name?: string
  readonly times?: number
  readonly delay?: number
  readonly predicates?: readonly RequestPredicate[]
  readonly graphql?: GraphQLMatch
  /** Validated against each reply's JSON body before it is sent. */
  readonly replySchema?: StandardSchemaV1
}

function define<State>(
  method: string,
  pattern: UrlPattern,
  respond: Responder<Record<string, string>, State>,
  extra?: Partial<HandlerDefinition<State>>,
): HandlerDefinition<State> {
  return { [HANDLER]: true, method, pattern, respond, ...extra }
}

export function isHandlerDefinition(value: unknown): value is HandlerDefinition {
  return (
    typeof value === 'object' && value !== null && (value as HandlerDefinition)[HANDLER] === true
  )
}

type HttpHelper = <const Path extends string, State = unknown>(
  path: Path | RegExp,
  respond: Responder<PathParams<Path>, State>,
) => HandlerDefinition<State>

function helper(method: string): HttpHelper {
  return (path, respond) =>
    define(method, path, respond as Responder<Record<string, string>, never>)
}

/**
 * Handler-table helpers, MSW-shaped:
 *
 * ```ts
 * export const handlers = [
 *   http.get('/api/users/:id', ({ params }) => json({ id: params.id })),
 *   http.post('/api/users', ({ body }) => created(body)),
 * ]
 * await api.use(handlers)
 * ```
 */
export const http = {
  get: helper('GET'),
  post: helper('POST'),
  put: helper('PUT'),
  patch: helper('PATCH'),
  delete: helper('DELETE'),
  head: helper('HEAD'),
  options: helper('OPTIONS'),
  all: helper('*'),
}

/** The endpoint a GraphQL handler matches when none is given. */
export const DEFAULT_GRAPHQL_ENDPOINT = '**/graphql'

type GraphQLHelper = <State = unknown>(
  operationName: string | RegExp | undefined,
  respond: Responder<Record<string, string>, State>,
  options?: { endpoint?: UrlPattern },
) => HandlerDefinition<State>

function graphqlHelper(type: GraphQLMatch['type']): GraphQLHelper {
  return (name, respond, options) =>
    define('*', options?.endpoint ?? DEFAULT_GRAPHQL_ENDPOINT, respond, {
      graphql: { type, name },
      name: `GraphQL ${type} ${name === undefined ? '(any)' : String(name)}`,
    })
}

/**
 * GraphQL handlers, matched by operation name rather than URL:
 *
 * ```ts
 * graphql.query('GetUser', ({ graphql }) => gqlData({ user: { id: graphql!.variables.id } }))
 * ```
 */
export const graphql = {
  query: graphqlHelper('query'),
  mutation: graphqlHelper('mutation'),
  /** Any operation type with this name. */
  operation: graphqlHelper('operation'),
}

/** A handler with its pattern compiled and its use counted. */
export class ActiveHandler {
  readonly definition: HandlerDefinition
  readonly pattern: CompiledPattern
  readonly calls: RecordedCall[] = []
  remaining: number
  removed = false

  constructor(definition: HandlerDefinition, baseUrl: string | undefined) {
    this.definition = definition
    this.pattern = compilePattern(definition.pattern, baseUrl)
    this.remaining = definition.times ?? Number.POSITIVE_INFINITY
  }

  get name(): string {
    return (
      this.definition.name ??
      `${this.definition.method === '*' ? 'ANY' : this.definition.method} ${this.pattern.source}`
    )
  }

  /** Method and URL only; predicates need the parsed request. */
  matchesRoute(method: string, url: URL): Record<string, string> | null {
    if (this.removed || this.remaining <= 0) return null
    const wanted = this.definition.method
    if (wanted !== '*' && wanted !== method) return null
    return this.pattern.match(url)
  }

  async matchesRequest(request: MockRequest): Promise<boolean> {
    const gql = this.definition.graphql
    if (gql !== undefined) {
      const operation = request.graphql
      if (operation === undefined) return false
      if (gql.type !== 'operation' && operation.operationType !== gql.type) return false
      if (gql.name !== undefined) {
        const name = operation.operationName ?? ''
        if (typeof gql.name === 'string' ? gql.name !== name : !gql.name.test(name)) return false
      }
    }
    for (const predicate of this.definition.predicates ?? []) {
      if (!(await predicate(request))) return false
    }
    return true
  }
}

/** A registered handler, as the test holds it: for assertions and removal. */
export class MockedRoute {
  readonly #active: ActiveHandler
  readonly #remove: () => void

  constructor(active: ActiveHandler, remove: () => void) {
    this.#active = active
    this.#remove = remove
  }

  get name(): string {
    return this.#active.name
  }

  /** Every request this handler answered, oldest first. */
  get calls(): readonly RecordedCall[] {
    return this.#active.calls
  }

  get callCount(): number {
    return this.#active.calls.length
  }

  get lastCall(): RecordedCall | undefined {
    return this.#active.calls.at(-1)
  }

  /** Uses left for a `.once()` / `.times(n)` handler; `Infinity` otherwise. */
  get remaining(): number {
    return this.#active.remaining
  }

  /** Unregisters the handler; later requests fall through to the ones below it. */
  remove(): void {
    this.#remove()
  }
}

/** True when every key in `subset` is present in `value` and equal, recursively. */
export function partialMatch(value: unknown, subset: unknown): boolean {
  if (subset instanceof RegExp) return typeof value === 'string' && subset.test(value)
  if (typeof subset !== 'object' || subset === null) return Object.is(value, subset)
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(subset)) {
    return (
      Array.isArray(value) &&
      value.length === subset.length &&
      subset.every((item, index) => partialMatch(value[index], item))
    )
  }
  return Object.entries(subset).every(([key, item]) =>
    partialMatch((value as Record<string, unknown>)[key], item),
  )
}

/**
 * The fluent form, compiled to a `HandlerDefinition` when `.reply()` is called:
 *
 * ```ts
 * await api.post('/api/orders').once().delay(200).withBody({ sku: 'A1' }).reply(created({ id: 1 }))
 * ```
 */
export class RouteBuilder<Params extends Record<string, string>, State, Body = unknown> {
  readonly #method: string
  readonly #pattern: UrlPattern
  readonly #register: (definition: HandlerDefinition<State>) => Promise<MockedRoute>
  #times: number | undefined
  #delay: number | undefined
  #name: string | undefined
  #replySchema: StandardSchemaV1 | undefined
  readonly #predicates: RequestPredicate[] = []

  constructor(
    method: string,
    pattern: UrlPattern,
    register: (definition: HandlerDefinition<State>) => Promise<MockedRoute>,
  ) {
    this.#method = method
    this.#pattern = pattern
    this.#register = register
  }

  /** Answers one request, then falls through to whatever is registered beneath. */
  once(): this {
    return this.times(1)
  }

  times(count: number): this {
    this.#times = count
    return this
  }

  /** Milliseconds before the response starts. */
  delay(ms: number): this {
    this.#delay = ms
    return this
  }

  /** Names the handler in logs and failure messages. */
  as(name: string): this {
    this.#name = name
    return this
  }

  /** Matches only when every given query parameter equals (or matches) its value. */
  withQuery(query: Record<string, string | RegExp>): this {
    this.#predicates.push(request =>
      Object.entries(query).every(([key, wanted]) => {
        const actual = request.query[key]
        if (actual === undefined) return false
        return typeof wanted === 'string' ? actual === wanted : wanted.test(actual)
      }),
    )
    return this
  }

  /** Matches only when every given header equals (or matches) its value. Names are case-insensitive. */
  withHeaders(headers: Record<string, string | RegExp>): this {
    this.#predicates.push(request =>
      Object.entries(headers).every(([key, wanted]) => {
        const actual = request.headers[key.toLowerCase()]
        if (actual === undefined) return false
        return typeof wanted === 'string' ? actual === wanted : wanted.test(actual)
      }),
    )
    return this
  }

  /**
   * Matches only when the parsed body contains `subset` (nested keys compared
   * recursively, RegExps tested against strings), or, given a Standard Schema
   * (Zod, Valibot, ArkType…), when the body is valid against it — and then the
   * handler's `body` is typed as the schema's output.
   */
  withBody<S extends StandardSchemaV1>(schema: S): RouteBuilder<Params, State, InferOutput<S>>
  withBody(subset: object): this
  withBody(subsetOrSchema: object): unknown {
    if (isStandardSchema(subsetOrSchema)) {
      this.#predicates.push(
        async request => (await standardIssues(subsetOrSchema, request.body)).length === 0,
      )
    } else {
      this.#predicates.push(request => partialMatch(request.body, subsetOrSchema))
    }
    return this
  }

  /** Matches only when `predicate` returns true. */
  where(predicate: (request: MockRequest<Params, State>) => boolean | Promise<boolean>): this {
    this.#predicates.push(predicate as RequestPredicate)
    return this
  }

  /** Validates each reply's JSON body against `schema`; a mismatch fails the test. */
  returns(schema: StandardSchemaV1): this {
    this.#replySchema = schema
    return this
  }

  /**
   * Registers the handler. Awaiting it waits until the runner is intercepting,
   * so a request fired straight after is caught.
   */
  reply(
    respond:
      | ReplyValue
      | ((
          request: MockRequest<Params, State> & { readonly body: Body },
        ) => HandlerResult | Promise<HandlerResult>),
  ): Promise<MockedRoute> {
    const extra: Partial<HandlerDefinition<State>> = { predicates: this.#predicates }
    if (this.#times !== undefined) (extra as { times: number }).times = this.#times
    if (this.#delay !== undefined) (extra as { delay: number }).delay = this.#delay
    if (this.#name !== undefined) (extra as { name: string }).name = this.#name
    if (this.#replySchema !== undefined)
      (extra as { replySchema: StandardSchemaV1 }).replySchema = this.#replySchema
    return this.#register(
      define(
        this.#method,
        this.#pattern,
        respond as Responder<Record<string, string>, State>,
        extra,
      ),
    )
  }
}
