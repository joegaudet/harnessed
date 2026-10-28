/**
 * The handler model every adapter consumes. Kept as plain data on purpose: a
 * native network hook often sits on the far side of a realm boundary (a browser
 * driven from Node, Cypress's spec iframe), and a `Response` object does not
 * cross one. A `MockReply` does.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/** A request exactly as a transport saw it, before anything was parsed. */
export interface RawRequest {
  method: string
  /** Absolute URL. */
  url: string
  /** Header names in any case; they are lower-cased on the way in. */
  headers: Record<string, string>
  body: string | Uint8Array | null
  /**
   * What fired it, when the transport knows. `fetch` and `xhr` are policed for
   * unhandled requests by default; documents, scripts and assets are not.
   */
  kind?: 'fetch' | 'xhr' | 'document' | 'other'
}

/** A timed piece of a streamed body. */
export interface ReplyChunk {
  data: string | Uint8Array
  /** Milliseconds to wait before this chunk, after the previous one. */
  delay: number
}

export type Fault = 'network-error' | 'abort' | 'hang'

/** Marks a reply produced by a builder, so a handler can return plain data too. */
export const REPLY: unique symbol = Symbol.for('harnessed.mock.reply') as never

/**
 * A response described as data. Builders produce these; handlers return them;
 * transports turn them into whatever their runner answers with.
 */
export interface MockReply {
  readonly [REPLY]: true
  status: number
  statusText?: string
  /** Lower-case names. */
  headers: Record<string, string>
  body: string | Uint8Array | null
  /** A body sent in timed pieces. When set, `body` is the concatenation. */
  chunks?: ReplyChunk[]
  /** Milliseconds before the response starts. */
  delay?: number
  /** A network-level failure instead of a response. */
  fault?: Fault
  /** Send this request to the real network instead. */
  passthrough?: boolean
  /** Read from disk when the reply is sent; needs a realm with `node:fs`. */
  file?: string
}

/**
 * The request a handler receives: parsed, typed by its path, and carrying the
 * mock's state.
 */
export interface MockRequest<
  Params extends Record<string, string> = Record<string, string>,
  State = unknown,
> {
  readonly method: string
  readonly url: URL
  /** Lower-case names. */
  readonly headers: Record<string, string>
  /** Named segments of the matched path, e.g. `{ id: '7' }` for `/users/:id`. */
  readonly params: Params
  /** Query string as a record; a repeated key keeps its last value. */
  readonly query: Record<string, string>
  /**
   * The body, parsed by its content type: JSON as a value, form encodings as a
   * record, anything else as text. `null` when there is none.
   */
  readonly body: unknown
  readonly rawBody: string | Uint8Array | null
  text(): string
  json<T = unknown>(): T
  /** Set when the request parses as a GraphQL operation. */
  readonly graphql: GraphQLRequest | undefined
  /** The mock's per-test state. Mutations persist for later requests. */
  readonly state: State
}

export interface GraphQLRequest {
  operationName: string | undefined
  operationType: 'query' | 'mutation' | 'subscription' | undefined
  query: string
  variables: Record<string, unknown>
}

/** What a handler may return: a built reply, or any value, sent as JSON. */
export type ReplyValue = MockReply | Response | StaticBody

/**
 * A value sent as JSON. Spelled out rather than `unknown`: `unknown` in a union
 * swallows the function type beside it, and `.reply(({ params }) => …)` would
 * lose its contextual typing.
 */
export type StaticBody = object | string | number | boolean | null

/** What a handler function may return; `undefined` declines, so the next handler is tried. */
export type HandlerResult = ReplyValue | undefined

/**
 * A handler's answer: a fixed value, or a function of the request. Declared
 * through a method so its parameter is bivariant — a handler written for
 * `/users/:id`'s `{ id: string }` must still be storable where params are
 * erased to `Record<string, string>`.
 */
export type ResponderFn<
  Params extends Record<string, string> = Record<string, string>,
  State = unknown,
> = {
  respond(request: MockRequest<Params, State>): HandlerResult | Promise<HandlerResult>
}['respond']

export type Responder<
  Params extends Record<string, string> = Record<string, string>,
  State = unknown,
> = ReplyValue | ResponderFn<Params, State>

/** One request the app made, as the log keeps it. */
export interface RecordedCall {
  readonly method: string
  readonly url: string
  readonly headers: Record<string, string>
  readonly body: unknown
  readonly params: Record<string, string>
  readonly query: Record<string, string>
  /** The handler that answered, `undefined` for one that was passed through or refused. */
  readonly handler: string | undefined
  readonly status: number | undefined
  readonly at: number
}

export function isReply(value: unknown): value is MockReply {
  return typeof value === 'object' && value !== null && (value as MockReply)[REPLY] === true
}
