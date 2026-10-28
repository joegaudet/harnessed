import type { EnvConfig } from '@harnessed-ts/core'
import { registerBeforeNavigate, timeoutFor } from '@harnessed-ts/core'
import { isApiHarnessClass } from './api-harness'
import type { ApiHarness, ApiHarnessConstructor, ApiOverrides } from './api-harness'
import { json, reply as buildReply } from './builders'
import { globals } from './globals'
import { harHandlers, toHar } from './har'
import type { FromHarOptions, Har } from './har'
import {
  ActiveHandler,
  DEFAULT_GRAPHQL_ENDPOINT,
  HANDLER,
  isHandlerDefinition,
  MockedRoute,
  RouteBuilder,
} from './handler'
import type { HandlerDefinition } from './handler'
import { fromMsw, isMswHandler } from './msw'
import type { MswHandlerLike } from './msw'
import { openApi } from './openapi'
import type { ExchangeValidator, OpenApiDocument, OpenApiOptions } from './openapi'
import { toMockRequest } from './request'
import { standardIssues } from './schema'
import { transportFor } from './transport'
import type {
  DispatchResult,
  Dispatcher,
  InstalledTransport,
  MockTransport,
  ObservedExchange,
} from './transport'
import { isReply } from './types'
import type {
  MockReply,
  MockRequest,
  RawRequest,
  RecordedCall,
  ReplyValue,
  ResponderFn,
} from './types'
import { compilePattern, inScope } from './url-pattern'
import type { CompiledPattern, PathParams, UrlPattern } from './url-pattern'
import { WsRoute } from './ws'
import type { WsConnectionTarget } from './ws'

export type UnhandledPolicy =
  | 'error'
  | 'warn'
  | 'bypass'
  | ((request: RawRequest, decide: { passthrough(): void; error(): void }) => void)

export interface MockOptions<State = unknown> {
  /**
   * The requests this mock is responsible for. A request in scope that no
   * handler answers is refused per `onUnhandled`; one outside it goes to the
   * network untouched. Defaults to every `fetch` and XHR request, which keeps
   * documents, scripts, styles and fonts out of it.
   */
  scope?: UrlPattern | UrlPattern[]
  /** What to do with an unanswered request in scope. Defaults to `'error'`. */
  onUnhandled?: UnhandledPolicy
  /** Resolves relative patterns against this origin and path instead of matching any origin. */
  baseUrl?: string
  /** Milliseconds added before every mocked reply. */
  latency?: number
  /**
   * Initial state, handed to every handler as `request.state`. Cloned with
   * `structuredClone` on creation and on every reset, so no test sees another's
   * writes.
   */
  state?: State
  /** Validates every mocked exchange against this OpenAPI document. */
  openapi?: OpenApiDocument | { document: OpenApiDocument; options?: OpenApiOptions }
  /** Further validators, e.g. `graphqlSchema(sdl)` from `@harnessed-ts/mock/graphql`. */
  validators?: ExchangeValidator[]
  /** Timeout for `waitFor`. Defaults to the harness timeout from `configure()`. */
  timeout?: number
}

/** What `api.use()` accepts. */
export type Mockable =
  | HandlerDefinition<unknown>
  | ApiHarness<unknown>
  | ApiHarnessConstructor
  | MswHandlerLike
  | readonly Mockable[]

/** Narrows which recorded requests a query is about. */
export type CallFilter = string | RegExp | MockedRoute | ((call: RecordedCall) => boolean)

export interface HarRecording {
  /** Stops recording and returns what was captured. */
  stop(): Promise<Har>
}

interface Waiter {
  matches: (call: RecordedCall) => boolean
  resolve: (call: RecordedCall) => void
}

const API_KINDS = new Set(['fetch', 'xhr'])

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
}

function normaliseScope(
  scope: MockOptions['scope'],
  baseUrl: string | undefined,
): CompiledPattern[] | undefined {
  if (scope === undefined) return undefined
  return (Array.isArray(scope) ? scope : [scope]).map(pattern => compilePattern(pattern, baseUrl))
}

/** Reads a `Response` (MSW handlers return them) into a reply. */
async function fromResponse(response: Response): Promise<MockReply> {
  if (response.type === 'error')
    return { ...buildReply(null, undefined, undefined, 0), fault: 'network-error' }
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  const body = response.body === null ? null : new Uint8Array(await response.arrayBuffer())
  return buildReply(body, undefined, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function isResponse(value: unknown): value is Response {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Response).arrayBuffer === 'function' &&
    typeof (value as Response).status === 'number' &&
    typeof (value as Response).headers?.forEach === 'function'
  )
}

/** Reads a file for `file()` replies through Node's builtin loader, so no bundler sees an import. */
function readFileSync(path: string): Uint8Array {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process
  const fs = proc?.getBuiltinModule?.('node:fs') as
    { readFileSync(path: string): Uint8Array } | undefined
  if (fs === undefined) {
    throw new Error(
      `harnessed: file("${path}") needs Node's filesystem, and this realm has none. Use bytes() with the content instead.`,
    )
  }
  return new Uint8Array(fs.readFileSync(path))
}

function describeFilter(filter: CallFilter): string {
  if (typeof filter === 'string') return filter
  if (filter instanceof RegExp) return String(filter)
  if (filter instanceof MockedRoute) return filter.name
  return 'a request matching the predicate'
}

/**
 * The mocks for one network — one page, one browser, one window. Get it with
 * `mock(env)`; every call for the same network returns the same instance.
 */
export class ApiMock<State = unknown> {
  readonly env: EnvConfig
  readonly transport: MockTransport
  readonly #key: object
  #options: MockOptions<State> = {}
  #scope: CompiledPattern[] | undefined
  #validators: ExchangeValidator[] = []
  #handlers: ActiveHandler[] = []
  #webSockets: WsRoute[] = []
  #calls: RecordedCall[] = []
  #errors: Error[] = []
  #waiters = new Set<Waiter>()
  #claimed = new WeakSet<RecordedCall>()
  #state: State = undefined as State
  #initialState: State = undefined as State
  #offline = false
  #installing: Promise<InstalledTransport> | undefined
  #installed: InstalledTransport | undefined
  #hanging = new Set<() => void>()
  #socketsChanged: Promise<void> = Promise.resolve()
  #recording: ObservedExchange[] | undefined
  #pageDefaults = new WeakSet<object>()
  #disposed = false

  constructor(env: EnvConfig, transport: MockTransport, key: object) {
    this.env = env
    this.transport = transport
    this.#key = key
  }

  /** Applies options; later calls merge over earlier ones. */
  configure(options: MockOptions<State>): this {
    this.#options = { ...this.#options, ...options }
    if ('scope' in options || 'baseUrl' in options) {
      this.#scope = normaliseScope(this.#options.scope, this.#options.baseUrl)
    }
    if ('state' in options) {
      this.#initialState = options.state as State
      this.#state = structuredClone(options.state) as State
    }
    if ('openapi' in options || 'validators' in options) {
      const validators = [...(this.#options.validators ?? [])]
      const spec = this.#options.openapi
      if (spec !== undefined) {
        validators.unshift(
          'document' in spec ? openApi(spec.document, spec.options) : openApi(spec),
        )
      }
      this.#validators = validators
    }
    return this
  }

  /** The per-test state handlers read and write. */
  get state(): State {
    return this.#state
  }

  set state(value: State) {
    this.#state = value
  }

  /** Resolves once the runner is intercepting. */
  async ready(): Promise<void> {
    if (this.#disposed)
      throw new Error('harnessed: this mock was disposed; call mock(env) for a new one')
    this.#installing ??= this.transport.install(this.env, this.#dispatcher()).then(installed => {
      this.#installed = installed
      return installed
    })
    await this.#installing
    // A socket route enables its transport's socket handling asynchronously;
    // "ready" includes that, so a page loaded next sees it.
    await this.#socketsChanged
  }

  // ----------------------------------------------------------- registration

  get<const Path extends string>(path: Path | RegExp): RouteBuilder<PathParams<Path>, State> {
    return this.route('GET', path)
  }
  post<const Path extends string>(path: Path | RegExp): RouteBuilder<PathParams<Path>, State> {
    return this.route('POST', path)
  }
  put<const Path extends string>(path: Path | RegExp): RouteBuilder<PathParams<Path>, State> {
    return this.route('PUT', path)
  }
  patch<const Path extends string>(path: Path | RegExp): RouteBuilder<PathParams<Path>, State> {
    return this.route('PATCH', path)
  }
  delete<const Path extends string>(path: Path | RegExp): RouteBuilder<PathParams<Path>, State> {
    return this.route('DELETE', path)
  }
  head<const Path extends string>(path: Path | RegExp): RouteBuilder<PathParams<Path>, State> {
    return this.route('HEAD', path)
  }
  options<const Path extends string>(path: Path | RegExp): RouteBuilder<PathParams<Path>, State> {
    return this.route('OPTIONS', path)
  }
  /** Any method. */
  all<const Path extends string>(path: Path | RegExp): RouteBuilder<PathParams<Path>, State> {
    return this.route('*', path)
  }

  route<const Path extends string>(
    method: string,
    path: Path | RegExp,
  ): RouteBuilder<PathParams<Path>, State> {
    return new RouteBuilder(method.toUpperCase(), path, definition => this.#register(definition))
  }

  /** GraphQL operations by name, on `endpoint` (default: any path ending in `/graphql`). */
  get graphql(): {
    query(
      name: string | RegExp,
      respond: HandlerDefinition<State>['respond'],
      options?: { endpoint?: UrlPattern },
    ): Promise<MockedRoute>
    mutation(
      name: string | RegExp,
      respond: HandlerDefinition<State>['respond'],
      options?: { endpoint?: UrlPattern },
    ): Promise<MockedRoute>
    operation(
      name: string | RegExp,
      respond: HandlerDefinition<State>['respond'],
      options?: { endpoint?: UrlPattern },
    ): Promise<MockedRoute>
  } {
    const make =
      (type: 'query' | 'mutation' | 'operation') =>
      (
        name: string | RegExp,
        respond: HandlerDefinition<State>['respond'],
        options?: { endpoint?: UrlPattern },
      ) =>
        this.#register({
          [HANDLER]: true,
          method: '*',
          pattern: options?.endpoint ?? DEFAULT_GRAPHQL_ENDPOINT,
          respond,
          graphql: { type, name },
          name: `GraphQL ${type} ${String(name)}`,
        } as HandlerDefinition<State>)
    return { query: make('query'), mutation: make('mutation'), operation: make('operation') }
  }

  /**
   * Registers handlers, API harnesses (class or instance) and MSW handlers, in
   * order — the last one given wins where two match. An API harness class may be
   * followed by an object replacing some of its routes by method name.
   *
   * ```ts
   * await api.use(UsersApi, { byId: () => serverError() })
   * await api.use(handlers, OrdersApi)
   * ```
   */
  use<T extends ApiHarness<unknown>>(
    harness: ApiHarnessConstructor<T>,
    overrides: ApiOverrides<T>,
  ): Promise<void>
  use(...items: Mockable[]): Promise<void>
  async use(...items: unknown[]): Promise<void> {
    for (const definition of this.#expand(items)) this.#add(definition, false)
    await this.ready()
  }

  /** Same as `use`, but beneath everything already registered: defaults a test can override. */
  async useDefaults(...items: Mockable[]): Promise<void> {
    for (const definition of this.#expand(items).reverse()) this.#add(definition, true)
    await this.ready()
  }

  /** Installs a page's declared `mocks` as defaults, once per page class. */
  async useFor(page: object | (abstract new (...args: never[]) => object)): Promise<void> {
    const proto =
      typeof page === 'function' ? (page.prototype as object) : Object.getPrototypeOf(page)
    const owner = proto.constructor as object
    if (this.#pageDefaults.has(owner)) return
    this.#pageDefaults.add(owner)
    const declared = Reflect.get(
      proto,
      'mocks',
      typeof page === 'function' ? proto : page,
    ) as unknown
    if (Array.isArray(declared) && declared.length > 0)
      await this.useDefaults(...(declared as Mockable[]))
  }

  /** Runs existing MSW request handlers through this runner's transport. */
  async useMsw(handlers: readonly MswHandlerLike[]): Promise<void> {
    await this.use(...handlers)
  }

  /** Answers from a recorded HAR: a parsed object, or a path read with `node:fs`. */
  async fromHar(har: Har | string, options?: FromHarOptions): Promise<void> {
    const parsed: Har =
      typeof har === 'string' ? JSON.parse(new TextDecoder().decode(readFileSync(har))) : har
    await this.use(...harHandlers(parsed, options))
  }

  /**
   * Records the real traffic that passes through, as a HAR. Only on runners
   * whose transport can observe real responses.
   */
  async recordHar(): Promise<HarRecording> {
    if (!this.transport.capabilities.harRecord) {
      throw new Error(
        `harnessed: the "${this.env.driver}" driver cannot record HAR files. Record under Playwright, Puppeteer or WebdriverIO (BiDi), then replay here with api.fromHar().`,
      )
    }
    await this.ready()
    const exchanges: ObservedExchange[] = []
    this.#recording = exchanges
    await this.#installed?.startRecording?.()
    return {
      stop: async () => {
        await this.#installed?.stopRecording?.()
        if (this.#recording === exchanges) this.#recording = undefined
        return toHar(exchanges)
      },
    }
  }

  /** A mocked WebSocket endpoint. */
  ws(pattern: UrlPattern): WsRoute {
    if (!this.transport.capabilities.websockets) {
      throw new Error(`harnessed: the "${this.env.driver}" driver cannot mock WebSockets.`)
    }
    const route = new WsRoute(pattern, this.#options.baseUrl)
    this.#webSockets.push(route)
    const changed = (this.#installing ?? this.ready()).then(() =>
      this.#installed?.webSocketsChanged?.(),
    )
    this.#socketsChanged = changed.catch(error =>
      this.#fail(`enabling WebSocket mocks failed: ${String(error)}`),
    )
    return route
  }

  /** Every request in scope now fails at the network level, mocked or not. */
  offline(): void {
    this.#offline = true
  }

  online(): void {
    this.#offline = false
  }

  // --------------------------------------------------------------- the log

  /** Requests the app made, oldest first, optionally narrowed. */
  calls(filter?: CallFilter): readonly RecordedCall[] {
    if (filter === undefined) return [...this.#calls]
    if (filter instanceof MockedRoute) return filter.calls
    const matches = this.#filter(filter)
    return this.#calls.filter(matches)
  }

  lastCall(filter?: CallFilter): RecordedCall | undefined {
    return this.calls(filter).at(-1)
  }

  /**
   * Resolves with a request matching `filter`: the earliest one not already
   * returned by a `waitFor`, or the next to arrive. `'POST /api/orders'` narrows
   * by method too.
   */
  waitFor(filter: CallFilter, options?: { timeout?: number }): Promise<RecordedCall> {
    const matches =
      filter instanceof MockedRoute
        ? (call: RecordedCall) => filter.calls.includes(call)
        : this.#filter(filter)
    const existing = this.#calls.find(call => !this.#claimed.has(call) && matches(call))
    if (existing !== undefined) {
      this.#claimed.add(existing)
      return Promise.resolve(existing)
    }
    const timeout = options?.timeout ?? this.#options.timeout ?? timeoutFor()
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        matches,
        resolve: call => {
          clearTimeout(timer)
          this.#waiters.delete(waiter)
          this.#claimed.add(call)
          resolve(call)
        },
      }
      const timer = setTimeout(() => {
        this.#waiters.delete(waiter)
        const seen = this.#calls.map(call => `  ${call.method} ${call.url}`).join('\n')
        reject(
          new Error(
            `harnessed: timed out after ${timeout}ms waiting for ${describeFilter(filter)}.` +
              (seen === '' ? ' No requests were made.' : `\nRequests made:\n${seen}`),
          ),
        )
      }, timeout)
      this.#waiters.add(waiter)
    })
  }

  // -------------------------------------------------------------- lifecycle

  /** Throws if a handler failed, a reply was invalid, or an in-scope request went unanswered. */
  verify(): void {
    const errors = this.#errors.splice(0)
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        `harnessed: ${errors.length} mock errors:\n${errors.map(e => `  - ${e.message}`).join('\n')}`,
      )
    }
  }

  /**
   * Clears handlers, sockets, the log and the offline switch, and re-clones the
   * initial state — then reports anything `verify()` would. The transport stays
   * installed, so the next test pays nothing to re-register.
   */
  reset(): void {
    this.#handlers = []
    for (const route of this.#webSockets) route.close()
    this.#webSockets = []
    this.#calls = []
    this.#waiters.clear()
    this.#offline = false
    this.#state = structuredClone(this.#initialState) as State
    this.#pageDefaults = new WeakSet()
    this.#releaseHanging()
    this.verify()
  }

  /** Stops intercepting. Later `mock(env)` calls start afresh. */
  async dispose(): Promise<void> {
    this.#disposed = true
    globals().mocks.delete(this.#key)
    globals().live.delete(this)
    this.#releaseHanging()
    const installed = await this.#installing?.catch(() => undefined)
    await installed?.dispose()
    this.reset()
  }

  // -------------------------------------------------------------- internals

  #expand(items: readonly unknown[]): HandlerDefinition<unknown>[] {
    const out: HandlerDefinition<unknown>[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (Array.isArray(item)) {
        out.push(...this.#expand(item))
      } else if (isHandlerDefinition(item)) {
        out.push(item)
      } else if (isApiHarnessClass(item)) {
        const next = items[i + 1]
        // A plain object straight after a class is its overrides; a handler
        // definition is plain too, but carries the brand.
        const overrides =
          typeof next === 'object' &&
          next !== null &&
          Object.getPrototypeOf(next) === Object.prototype &&
          !isHandlerDefinition(next)
            ? (items[++i] as Record<string, unknown>)
            : undefined
        out.push(...new item().handlers(overrides as never))
      } else if (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ApiHarness).handlers === 'function'
      ) {
        out.push(...(item as ApiHarness).handlers())
      } else if (isMswHandler(item)) {
        out.push(fromMsw(item, this.#options.baseUrl))
      } else {
        throw new TypeError(
          `harnessed: api.use() was given something it does not understand: ${Object.prototype.toString.call(item)}. ` +
            'It takes handlers from http.*/graphql.*, API harness classes or instances, and MSW handlers.',
        )
      }
    }
    return out
  }

  #add(definition: HandlerDefinition<unknown>, beneath: boolean): ActiveHandler {
    const active = new ActiveHandler(definition, this.#options.baseUrl)
    if (beneath) this.#handlers.unshift(active)
    else this.#handlers.push(active)
    return active
  }

  async #register(definition: HandlerDefinition<unknown>): Promise<MockedRoute> {
    const active = this.#add(definition, false)
    const route = new MockedRoute(active, () => {
      active.removed = true
      this.#handlers = this.#handlers.filter(handler => handler !== active)
    })
    await this.ready()
    return route
  }

  #filter(filter: Exclude<CallFilter, MockedRoute>): (call: RecordedCall) => boolean {
    if (typeof filter === 'function') return filter
    if (filter instanceof RegExp) return call => filter.test(call.url)
    const spaced = /^([A-Z]+)\s+(\S+)$/.exec(filter.trim())
    const method = spaced?.[1]
    const pattern = compilePattern(spaced?.[2] ?? filter.trim(), this.#options.baseUrl)
    return call =>
      (method === undefined || call.method === method) && pattern.match(new URL(call.url)) !== null
  }

  #record(call: RecordedCall, active: ActiveHandler | undefined): void {
    this.#calls.push(call)
    active?.calls.push(call)
    for (const waiter of [...this.#waiters]) if (waiter.matches(call)) waiter.resolve(call)
  }

  #fail(message: string): void {
    const error = new Error(`harnessed: ${message}`)
    this.#errors.push(error)
    // Also printed: a test whose app swallows the failure should still say why.
    console.error(error.message)
  }

  #isPoliced(url: URL, raw: RawRequest): boolean {
    if (this.#scope !== undefined) return inScope(url, this.#scope)
    return raw.kind === undefined || API_KINDS.has(raw.kind)
  }

  #releaseHanging(): void {
    for (const release of this.#hanging) release()
    this.#hanging.clear()
  }

  #hang(): Promise<DispatchResult> {
    return new Promise(resolve => {
      const release = (): void => resolve({ kind: 'error', fault: 'abort' })
      this.#hanging.add(release)
    })
  }

  async #toReply(value: ReplyValue | undefined): Promise<MockReply | undefined> {
    if (value === undefined) return undefined
    if (isReply(value)) return value
    if (isResponse(value)) return fromResponse(value)
    return json(value)
  }

  async #validate(
    request: MockRequest,
    reply: MockReply | undefined,
    active: ActiveHandler,
  ): Promise<string[]> {
    const problems: string[] = []
    for (const validator of this.#validators) {
      if (reply === undefined)
        problems.push(...((await validator.validateRequest?.(request)) ?? []))
      else problems.push(...((await validator.validateReply?.(request, reply)) ?? []))
    }
    const schema = active.definition.replySchema
    if (reply !== undefined && schema !== undefined && reply.body !== null) {
      let value: unknown
      try {
        value = JSON.parse(
          typeof reply.body === 'string' ? reply.body : new TextDecoder().decode(reply.body),
        )
      } catch {
        value = reply.body
      }
      problems.push(
        ...(await standardIssues(schema, value)).map(issue => `${active.name} reply: ${issue}`),
      )
    }
    return problems
  }

  async #dispatch(raw: RawRequest): Promise<DispatchResult> {
    const url = new URL(raw.url)
    const method = raw.method.toUpperCase()
    const policed = this.#isPoliced(url, raw)
    const at = Date.now()

    if (this.#offline && policed) {
      this.#record(this.#call(raw, undefined, undefined, {}, undefined, at), undefined)
      return { kind: 'error', fault: 'network-error' }
    }

    for (let i = this.#handlers.length - 1; i >= 0; i--) {
      const active = this.#handlers[i]!
      const params = active.matchesRoute(method, url)
      if (params === null) continue
      const request = toMockRequest(raw, params, this.#state)
      if (!(await active.matchesRequest(request))) continue

      let reply: MockReply | undefined
      try {
        for (const problem of await this.#validate(request, undefined, active)) this.#fail(problem)
        const respond = active.definition.respond
        const value =
          typeof respond === 'function'
            ? await (respond as ResponderFn<Record<string, string>, State>)(request)
            : respond
        reply = await this.#toReply(value)
      } catch (error) {
        this.#fail(
          `${active.name} threw while answering ${method} ${url.href}: ${(error as Error)?.stack ?? String(error)}`,
        )
        reply = buildReply(String((error as Error)?.message ?? error), 'text/plain', {
          status: 500,
        })
      }
      // `undefined` falls through, as in MSW: a handler may decline a request.
      if (reply === undefined) continue
      // Counted only once it answered, so a declined request does not use up a `.once()`.
      active.remaining -= 1

      for (const problem of await this.#validate(request, reply, active)) this.#fail(problem)
      if (reply.file !== undefined) {
        try {
          reply = { ...reply, body: readFileSync(reply.file) }
        } catch (error) {
          this.#fail((error as Error).message.replace(/^harnessed: /, ''))
          reply = buildReply(null, undefined, { status: 500 })
        }
      }

      this.#record(
        this.#call(
          raw,
          request.body,
          active.name,
          params,
          reply.fault === undefined ? reply.status : undefined,
          at,
        ),
        active,
      )
      await wait((this.#options.latency ?? 0) + (active.definition.delay ?? 0) + (reply.delay ?? 0))

      if (reply.passthrough === true) return { kind: 'passthrough' }
      if (reply.fault === 'hang') return this.#hang()
      if (reply.fault !== undefined) return { kind: 'error', fault: reply.fault }
      return { kind: 'reply', reply }
    }

    if (!policed) return { kind: 'passthrough' }
    this.#record(
      this.#call(raw, toMockRequest(raw, {}, this.#state).body, undefined, {}, undefined, at),
      undefined,
    )
    return this.#unhandled(raw, method, url)
  }

  #unhandled(raw: RawRequest, method: string, url: URL): DispatchResult {
    const policy = this.#options.onUnhandled ?? 'error'
    const candidates = this.#handlers
      .filter(handler => !handler.removed)
      .map(handler => `  ${handler.name}${handler.remaining <= 0 ? ' (used up)' : ''}`)
      .slice(-5)
      .join('\n')
    const message =
      `no mock answered ${method} ${url.href}.` +
      (candidates === ''
        ? ' No handlers are registered.'
        : `\nRegistered handlers (newest last):\n${candidates}`) +
      '\nAdd a handler for it, widen or narrow `scope`, or set `onUnhandled`.'
    if (typeof policy === 'function') {
      let result: DispatchResult = { kind: 'passthrough' }
      policy(raw, {
        passthrough: () => {
          result = { kind: 'passthrough' }
        },
        error: () => {
          this.#fail(message)
          result = { kind: 'error', fault: 'network-error' }
        },
      })
      return result
    }
    if (policy === 'bypass') return { kind: 'passthrough' }
    if (policy === 'warn') {
      console.warn(`harnessed: ${message}`)
      return { kind: 'passthrough' }
    }
    this.#fail(message)
    return { kind: 'error', fault: 'network-error' }
  }

  #call(
    raw: RawRequest,
    body: unknown,
    handler: string | undefined,
    params: Record<string, string>,
    status: number | undefined,
    at: number,
  ): RecordedCall {
    const url = new URL(raw.url)
    const query: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw.headers)) headers[key.toLowerCase()] = value
    return {
      method: raw.method.toUpperCase(),
      url: url.href,
      headers,
      body,
      params,
      query,
      handler,
      status,
      at,
    }
  }

  #connect(url: string): WsConnectionTarget | undefined {
    const parsed = new URL(url)
    for (let i = this.#webSockets.length - 1; i >= 0; i--) {
      const route = this.#webSockets[i]!
      if (route.pattern.match(parsed) !== null) {
        return route.accept(url, error =>
          this.#fail(`WebSocket handler for ${url} threw: ${String(error)}`),
        )
      }
    }
    return undefined
  }

  #dispatcher(): Dispatcher {
    return {
      dispatch: raw => this.#dispatch(raw),
      connect: url => this.#connect(url),
      hasWebSockets: () => this.#webSockets.length > 0,
      observe: exchange => {
        this.#recording?.push(exchange)
      },
    }
  }
}

/**
 * The mocks for the network an env drives. The same env — or any env on the
 * same page — always gets the same instance; `options` merge into it.
 *
 * ```ts
 * const api = mock(env, { scope: '/api/**', state: { users: [] } })
 * await api.get('/api/users/:id').reply(({ params }) => json({ id: params.id }))
 * ```
 */
export function mock<State = unknown>(
  env: EnvConfig,
  options?: MockOptions<State>,
): ApiMock<State> {
  const transport = transportFor(env)
  const key = transport.key(env)
  const registry = globals()
  let api = registry.mocks.get(key) as ApiMock<State> | undefined
  if (api === undefined) {
    api = new ApiMock<State>(env, transport, key)
    registry.mocks.set(key, api)
    registry.live.add(api)
    // Start intercepting now: a request fired before the first handler is
    // registered is still seen, and refused if it is in scope.
    void api.ready().catch(() => {})
  }
  if (options !== undefined) api.configure(options)
  return api
}

/**
 * Resets every live mock, reporting what `verify()` would. Put it in an
 * after-each hook for runners whose network outlives a test — jsdom, Ember,
 * Vitest browser, WebdriverIO:
 *
 * ```ts
 * afterEach(() => resetMocks())
 * ```
 */
export function resetMocks(): void {
  const errors: Error[] = []
  for (const api of globals().live) {
    try {
      api.reset()
    } catch (error) {
      errors.push(error as Error)
    }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1)
    throw new AggregateError(errors, errors.map(error => error.message).join('\n'))
}

/** The live mock for an env's network, if one was created. Never creates one. */
export function existingMock(env: EnvConfig): ApiMock | undefined {
  const transport = globals().transports.get(env.driver)
  return transport === undefined ? undefined : globals().mocks.get(transport.key(env))
}

// Before a page navigates: install its declared mocks, and wait for any mock on
// its network to be intercepting — so a request fired while it loads is caught.
registerBeforeNavigate('@harnessed-ts/mock', async (env, page) => {
  if (!globals().transports.has(env.driver)) return
  const declared = (page as { mocks?: unknown }).mocks
  if (Array.isArray(declared) && declared.length > 0) await mock(env).useFor(page)
  await existingMock(env)?.ready()
})
