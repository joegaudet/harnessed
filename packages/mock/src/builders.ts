/**
 * Response builders. Pure functions returning a `MockReply`: they build data
 * and touch no runner, so they work in any realm and tree-shake.
 *
 * Every builder takes `init` last to override status and add headers or
 * cookies:
 *
 * ```ts
 * json(user, { status: 201, headers: { etag: '"v2"' } })
 * ```
 */
import { REPLY } from './types'
import type { MockReply, ReplyChunk } from './types'

export interface ReplyInit {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  /** Sent as `Set-Cookie` headers. */
  cookies?: Record<string, string>
}

function lowerKeys(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers ?? {})) out[key.toLowerCase()] = value
  return out
}

/** The one place a reply object is assembled. */
export function reply(
  body: MockReply['body'],
  contentType: string | undefined,
  init: ReplyInit | undefined,
  defaultStatus = 200,
): MockReply {
  const headers: Record<string, string> = {}
  if (contentType !== undefined) headers['content-type'] = contentType
  Object.assign(headers, lowerKeys(init?.headers))
  const cookies = Object.entries(init?.cookies ?? {})
  if (cookies.length > 0) {
    // One header can hold one cookie; joining with a newline is what fetch's
    // Headers and every transport here split on.
    headers['set-cookie'] = cookies.map(([name, value]) => `${name}=${value}`).join('\n')
  }
  const result: MockReply = { [REPLY]: true, status: init?.status ?? defaultStatus, headers, body }
  if (init?.statusText !== undefined) result.statusText = init.statusText
  return result
}

/** A copy of `base` with `patch` applied — builders compose through this. */
export function withReply(
  base: MockReply,
  patch: Partial<Omit<MockReply, typeof REPLY>>,
): MockReply {
  return { ...base, ...patch, headers: { ...base.headers, ...lowerKeys(patch.headers) } }
}

/** The same reply, sent after `ms` milliseconds. */
export function delayed(base: MockReply, ms: number): MockReply {
  return withReply(base, { delay: ms })
}

// ------------------------------------------------------------------- bodies

export function json(value: unknown, init?: ReplyInit): MockReply {
  return reply(JSON.stringify(value ?? null), 'application/json', init)
}

export function text(value: string, init?: ReplyInit): MockReply {
  return reply(value, 'text/plain; charset=utf-8', init)
}

export function html(value: string, init?: ReplyInit): MockReply {
  return reply(value, 'text/html; charset=utf-8', init)
}

export function xml(value: string, init?: ReplyInit): MockReply {
  return reply(value, 'application/xml; charset=utf-8', init)
}

export interface BinaryInit extends ReplyInit {
  contentType?: string
  /** Sets `Content-Disposition: attachment; filename="…"`. */
  filename?: string
}

function disposition(init: BinaryInit | undefined): ReplyInit | undefined {
  if (init?.filename === undefined) return init
  return {
    ...init,
    headers: {
      'content-disposition': `attachment; filename="${init.filename}"`,
      ...init.headers,
    },
  }
}

/** Raw bytes. Defaults to `application/octet-stream`. */
export function bytes(value: Uint8Array | ArrayBuffer, init?: BinaryInit): MockReply {
  const data = value instanceof Uint8Array ? value : new Uint8Array(value)
  return reply(data, init?.contentType ?? 'application/octet-stream', disposition(init))
}

/**
 * A file read from disk when the reply is sent. Needs `node:fs`, so it works
 * wherever handlers run in Node — every browser driver — but not under an
 * in-page driver (jsdom aside), which has no filesystem; use `bytes()` there.
 */
export function file(path: string | URL, init?: BinaryInit): MockReply {
  const resolved = typeof path === 'string' ? path : decodeURIComponent(path.pathname)
  const filename = init?.filename ?? resolved.split(/[\\/]/).pop()
  const result = reply(
    null,
    init?.contentType ?? contentTypeFor(resolved),
    disposition({ ...init, ...(filename === undefined ? {} : { filename }) }),
  )
  result.file = resolved
  return result
}

const TYPES: Record<string, string> = {
  json: 'application/json',
  txt: 'text/plain',
  html: 'text/html',
  csv: 'text/csv',
  xml: 'application/xml',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  zip: 'application/zip',
  js: 'text/javascript',
  css: 'text/css',
}

function contentTypeFor(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return TYPES[extension] ?? 'application/octet-stream'
}

/** `application/x-www-form-urlencoded`. */
export function urlencoded(fields: Record<string, string | string[]>, init?: ReplyInit): MockReply {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item)
  }
  return reply(params.toString(), 'application/x-www-form-urlencoded', init)
}

/** `multipart/form-data` with a fixed boundary, so a body is stable between runs. */
export function formData(
  fields: Record<
    string,
    string | string[] | { filename: string; content: string; contentType?: string }
  >,
  init?: ReplyInit,
): MockReply {
  const boundary = 'harnessed-boundary'
  let body = ''
  for (const [key, value] of Object.entries(fields)) {
    const items = Array.isArray(value) ? value : [value]
    for (const item of items) {
      body += `--${boundary}\r\n`
      if (typeof item === 'string') {
        body += `Content-Disposition: form-data; name="${key}"\r\n\r\n${item}\r\n`
      } else {
        body +=
          `Content-Disposition: form-data; name="${key}"; filename="${item.filename}"\r\n` +
          `Content-Type: ${item.contentType ?? 'application/octet-stream'}\r\n\r\n${item.content}\r\n`
      }
    }
  }
  body += `--${boundary}--\r\n`
  return reply(body, `multipart/form-data; boundary=${boundary}`, init)
}

// ---------------------------------------------------------------- streaming

export interface StreamInit extends ReplyInit {
  /** Milliseconds between pieces. Defaults to 0. */
  interval?: number
}

function streamed(
  parts: (string | Uint8Array)[],
  contentType: string,
  init?: StreamInit,
): MockReply {
  const interval = init?.interval ?? 0
  const chunks: ReplyChunk[] = parts.map((data, index) => ({
    data,
    delay: index === 0 ? 0 : interval,
  }))
  const joined = parts.every(part => typeof part === 'string')
    ? parts.join('')
    : concatBytes(parts.map(part => (typeof part === 'string' ? encode(part) : part)))
  const result = reply(joined, contentType, init)
  result.chunks = chunks
  return result
}

export interface ServerSentEvent {
  data: unknown
  event?: string
  id?: string
  retry?: number
}

/**
 * `text/event-stream`. Strings are sent as-is as `data:`; anything else is JSON.
 * Delivered piece by piece where the runner can stream, all at once where it
 * cannot — an `EventSource` sees every event either way.
 */
export function sse(events: (ServerSentEvent | string)[], init?: StreamInit): MockReply {
  const parts = events.map(event => {
    const item = typeof event === 'string' ? { data: event } : event
    let out = ''
    if (item.event !== undefined) out += `event: ${item.event}\n`
    if (item.id !== undefined) out += `id: ${item.id}\n`
    if (item.retry !== undefined) out += `retry: ${item.retry}\n`
    const data = typeof item.data === 'string' ? item.data : JSON.stringify(item.data)
    for (const line of data.split('\n')) out += `data: ${line}\n`
    return `${out}\n`
  })
  return streamed(parts, 'text/event-stream', {
    ...init,
    headers: { 'cache-control': 'no-cache', ...init?.headers },
  })
}

/** Newline-delimited JSON, one item per line. */
export function ndjson(items: unknown[], init?: StreamInit): MockReply {
  return streamed(
    items.map(item => `${JSON.stringify(item)}\n`),
    'application/x-ndjson',
    init,
  )
}

/** A body in timed pieces, of whatever content type. */
export function chunked(
  parts: (string | Uint8Array)[],
  init?: StreamInit & { contentType?: string },
): MockReply {
  return streamed(parts, init?.contentType ?? 'text/plain; charset=utf-8', init)
}

// ------------------------------------------------------------------- status

/** Any status, with an optional JSON body. */
export function status(code: number, body?: unknown, init?: ReplyInit): MockReply {
  return body === undefined
    ? reply(null, undefined, { ...init, status: code })
    : json(body, { ...init, status: code })
}

export const ok = (body?: unknown, init?: ReplyInit): MockReply => status(200, body, init)
export const created = (body?: unknown, init?: ReplyInit): MockReply => status(201, body, init)
export const accepted = (body?: unknown, init?: ReplyInit): MockReply => status(202, body, init)
export const noContent = (init?: ReplyInit): MockReply => status(204, undefined, init)
export const notModified = (init?: ReplyInit): MockReply => status(304, undefined, init)

export function redirect(
  location: string,
  code: 301 | 302 | 303 | 307 | 308 = 302,
  init?: ReplyInit,
): MockReply {
  return reply(null, undefined, { ...init, status: code, headers: { location, ...init?.headers } })
}

// ------------------------------------------------------------------- errors

export const badRequest = (body?: unknown, init?: ReplyInit): MockReply => status(400, body, init)
export const unauthorized = (body?: unknown, init?: ReplyInit): MockReply => status(401, body, init)
export const forbidden = (body?: unknown, init?: ReplyInit): MockReply => status(403, body, init)
export const notFound = (body?: unknown, init?: ReplyInit): MockReply => status(404, body, init)
export const conflict = (body?: unknown, init?: ReplyInit): MockReply => status(409, body, init)
export const unprocessable = (body?: unknown, init?: ReplyInit): MockReply =>
  status(422, body, init)
export const serverError = (body?: unknown, init?: ReplyInit): MockReply => status(500, body, init)
export const badGateway = (body?: unknown, init?: ReplyInit): MockReply => status(502, body, init)
export const unavailable = (body?: unknown, init?: ReplyInit): MockReply => status(503, body, init)

/** 429, with `Retry-After` in seconds when given. */
export function tooManyRequests(retryAfter?: number, body?: unknown, init?: ReplyInit): MockReply {
  const headers =
    retryAfter === undefined
      ? init?.headers
      : { 'retry-after': String(retryAfter), ...init?.headers }
  return status(429, body, { ...init, ...(headers === undefined ? {} : { headers }) })
}

// ------------------------------------------------------- problem details

export interface ProblemDetails {
  status: number
  type?: string
  title?: string
  detail?: string
  instance?: string
  [extension: string]: unknown
}

/** RFC 9457 problem details, as `application/problem+json`. */
export function problem(details: ProblemDetails, init?: ReplyInit): MockReply {
  const body = { type: 'about:blank', ...details }
  return reply(JSON.stringify(body), 'application/problem+json', {
    ...init,
    status: details.status,
  })
}

/** A 422 problem whose `errors` maps each field to its messages. */
export function validationProblem(
  errors: Record<string, string | string[]>,
  details?: Partial<ProblemDetails>,
  init?: ReplyInit,
): MockReply {
  const normalised = Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages : [messages],
    ]),
  )
  return problem({ status: 422, title: 'Validation failed', ...details, errors: normalised }, init)
}

// ------------------------------------------------------------------- faults

/** The request fails at the network level: `fetch` rejects with a `TypeError`. */
export function networkError(): MockReply {
  return { ...reply(null, undefined, undefined, 0), fault: 'network-error' }
}

/** The request is aborted, as if the connection were dropped mid-flight. */
export function abort(): MockReply {
  return { ...reply(null, undefined, undefined, 0), fault: 'abort' }
}

/** The request never answers: for loading states and client-side timeouts. */
export function hang(): MockReply {
  return { ...reply(null, undefined, undefined, 0), fault: 'hang' }
}

/** Let this one request through to the real network. */
export function passthrough(): MockReply {
  return { ...reply(null, undefined, undefined, 0), passthrough: true }
}

/** Adds the headers a cross-origin API needs for the browser to hand the body over. */
export function withCors(base: MockReply, origin = '*'): MockReply {
  return withReply(base, {
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-expose-headers': '*',
    },
  })
}

// ------------------------------------------------------------------ JSON:API

export interface JsonApiResource {
  type: string
  id: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, { data: JsonApiIdentifier | JsonApiIdentifier[] | null }>
  links?: Record<string, string>
  meta?: Record<string, unknown>
}

export interface JsonApiIdentifier {
  type: string
  id: string
}

export interface JsonApiDocumentOptions {
  included?: JsonApiResource[]
  meta?: Record<string, unknown>
  links?: Record<string, string>
}

const JSON_API = 'application/vnd.api+json'

/**
 * Builds a resource object from a flat record: `id` becomes the id, everything
 * else an attribute, except the keys named in `relationships`.
 */
function toResource(
  type: string,
  record: Record<string, unknown> & { id: string | number },
  relationships?: Record<string, JsonApiIdentifier | JsonApiIdentifier[] | null>,
): JsonApiResource {
  const { id, ...attributes } = record
  const resource: JsonApiResource = { type, id: String(id), attributes }
  if (relationships !== undefined) {
    resource.relationships = Object.fromEntries(
      Object.entries(relationships).map(([name, data]) => [name, { data }]),
    )
  }
  return resource
}

function jsonApiDocument(
  data: JsonApiResource | JsonApiResource[] | null,
  options: JsonApiDocumentOptions | undefined,
  init: ReplyInit | undefined,
): MockReply {
  const body: Record<string, unknown> = { data }
  if (options?.included !== undefined) body['included'] = options.included
  if (options?.meta !== undefined) body['meta'] = options.meta
  if (options?.links !== undefined) body['links'] = options.links
  return reply(JSON.stringify(body), JSON_API, init)
}

/** JSON:API builders — Ember Data's default wire format. */
export const jsonApi = {
  /** A resource object, for `included` or `relationships`. */
  toResource,

  /** A single-resource document. */
  resource(
    type: string,
    record: Record<string, unknown> & { id: string | number },
    options?: JsonApiDocumentOptions & {
      relationships?: Record<string, JsonApiIdentifier | JsonApiIdentifier[] | null>
    },
    init?: ReplyInit,
  ): MockReply {
    return jsonApiDocument(toResource(type, record, options?.relationships), options, init)
  },

  /** A collection document. */
  collection(
    type: string,
    records: (Record<string, unknown> & { id: string | number })[],
    options?: JsonApiDocumentOptions,
    init?: ReplyInit,
  ): MockReply {
    return jsonApiDocument(
      records.map(record => toResource(type, record)),
      options,
      init,
    )
  },

  /** `{ data: null }`, for an empty to-one relationship or a missing record. */
  empty(init?: ReplyInit): MockReply {
    return jsonApiDocument(null, undefined, init)
  },

  /** An errors document. Status defaults to the first error's, else 422. */
  errors(
    errors: {
      status?: string | number
      title?: string
      detail?: string
      source?: { pointer?: string; parameter?: string }
      code?: string
    }[],
    init?: ReplyInit,
  ): MockReply {
    const first = errors[0]?.status
    const code = init?.status ?? (first === undefined ? 422 : Number(first))
    const normalised = errors.map(error =>
      error.status === undefined ? error : { ...error, status: String(error.status) },
    )
    return reply(JSON.stringify({ errors: normalised }), JSON_API, { ...init, status: code })
  },

  noContent(init?: ReplyInit): MockReply {
    return noContent(init)
  },
}

// ------------------------------------------------------------------- GraphQL

export interface GraphQLError {
  message: string
  path?: (string | number)[]
  locations?: { line: number; column: number }[]
  extensions?: Record<string, unknown>
}

/** A successful GraphQL result. */
export function gqlData(data: Record<string, unknown>, init?: ReplyInit): MockReply {
  return json({ data }, init)
}

/** A GraphQL result with errors, and optionally the partial data alongside them. */
export function gqlErrors(
  errors: (GraphQLError | string)[],
  data?: Record<string, unknown> | null,
  init?: ReplyInit,
): MockReply {
  const normalised = errors.map(error => (typeof error === 'string' ? { message: error } : error))
  return json(data === undefined ? { errors: normalised } : { data, errors: normalised }, init)
}

// ------------------------------------------------------------------ helpers

const encoder = new TextEncoder()

export function encode(value: string): Uint8Array {
  return encoder.encode(value)
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
