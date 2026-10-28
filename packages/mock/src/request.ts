import type { GraphQLRequest, MockRequest, RawRequest } from './types'

const decoder = new TextDecoder()

export function bodyText(body: RawRequest['body']): string {
  if (body === null) return ''
  return typeof body === 'string' ? body : decoder.decode(body)
}

function lowerHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = value
  return out
}

function queryRecord(url: URL): Record<string, string> {
  const out: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    out[key] = value
  })
  return out
}

/** Parses a multipart body's text fields. Files come back as their content. */
function parseMultipart(body: string, contentType: string): Record<string, string | string[]> {
  const boundary = /boundary=("?)([^";]+)\1/i.exec(contentType)?.[2]
  const out: Record<string, string | string[]> = {}
  if (boundary === undefined) return out
  for (const part of body.split(`--${boundary}`)) {
    const split = part.indexOf('\r\n\r\n')
    if (split === -1) continue
    const head = part.slice(0, split)
    const name = /name="([^"]*)"/i.exec(head)?.[1]
    if (name === undefined) continue
    const value = part.slice(split + 4).replace(/\r\n$/, '')
    add(out, name, value)
  }
  return out
}

function add(out: Record<string, string | string[]>, key: string, value: string): void {
  const existing = out[key]
  if (existing === undefined) out[key] = value
  else if (Array.isArray(existing)) existing.push(value)
  else out[key] = [existing, value]
}

/** The body, read the way its content type says to. */
export function parseBody(raw: RawRequest['body'], contentType: string | undefined): unknown {
  if (raw === null) return null
  const textBody = bodyText(raw)
  if (textBody === '') return null
  const type = (contentType ?? '').toLowerCase()
  if (type.includes('json') || (type === '' && /^\s*[[{]/.test(textBody))) {
    try {
      return JSON.parse(textBody)
    } catch {
      return textBody
    }
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    const out: Record<string, string | string[]> = {}
    new URLSearchParams(textBody).forEach((value, key) => add(out, key, value))
    return out
  }
  if (type.includes('multipart/form-data')) return parseMultipart(textBody, contentType!)
  return textBody
}

const OPERATION = /^\s*(query|mutation|subscription)\b\s*([A-Za-z_][A-Za-z0-9_]*)?/m

/** Reads a GraphQL operation from a POST body or a GET query string. */
export function parseGraphQL(method: string, url: URL, body: unknown): GraphQLRequest | undefined {
  let payload: { query?: unknown; operationName?: unknown; variables?: unknown } | undefined
  if (method === 'GET' && url.searchParams.has('query')) {
    const variables = url.searchParams.get('variables')
    payload = {
      query: url.searchParams.get('query'),
      operationName: url.searchParams.get('operationName') ?? undefined,
      variables: variables === null ? {} : JSON.parse(variables),
    }
  } else if (typeof body === 'object' && body !== null && 'query' in body) {
    payload = body as typeof payload
  }
  if (payload === undefined || typeof payload.query !== 'string') return undefined

  const query = payload.query
  const header = OPERATION.exec(query)
  // An anonymous shorthand `{ … }` is a query.
  const operationType = (header?.[1] ??
    (/^\s*\{/.test(query) ? 'query' : undefined)) as GraphQLRequest['operationType']
  const operationName =
    typeof payload.operationName === 'string' && payload.operationName !== ''
      ? payload.operationName
      : header?.[2]
  return {
    operationName,
    operationType,
    query,
    variables: (payload.variables as Record<string, unknown> | undefined) ?? {},
  }
}

/** What every handler is called with. Parsing is done once, here. */
export function toMockRequest<State>(
  raw: RawRequest,
  params: Record<string, string>,
  state: State,
): MockRequest<Record<string, string>, State> {
  const url = new URL(raw.url)
  const headers = lowerHeaders(raw.headers)
  const method = raw.method.toUpperCase()
  const body = parseBody(raw.body, headers['content-type'])
  return {
    method,
    url,
    headers,
    params,
    query: queryRecord(url),
    body,
    rawBody: raw.body,
    text: () => bodyText(raw.body),
    json: <T>() => JSON.parse(bodyText(raw.body)) as T,
    graphql: parseGraphQL(method, url, body),
    state,
  }
}
