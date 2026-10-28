/**
 * OpenAPI validation with no dependencies: a JSON Schema subset that covers what
 * OpenAPI 3.0 and 3.1 documents use, so a mock cannot drift from the API it
 * stands in for without a test saying so.
 */
import { bodyText } from './request'
import { compilePattern } from './url-pattern'
import type { CompiledPattern } from './url-pattern'
import type { MockReply, MockRequest } from './types'

/** Checks one exchange; returns readable problems, or `[]`. */
export interface ExchangeValidator {
  readonly name: string
  validateRequest?(request: MockRequest): string[] | Promise<string[]>
  validateReply?(request: MockRequest, reply: MockReply): string[] | Promise<string[]>
}

/** The JSON Schema keywords this validator reads; others are ignored. */
export interface SchemaObject {
  $ref?: string
  type?: string | string[]
  nullable?: boolean
  enum?: unknown[]
  const?: unknown
  format?: string
  pattern?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number | boolean
  exclusiveMaximum?: number | boolean
  minItems?: number
  maxItems?: number
  items?: Schema | Schema[]
  properties?: Record<string, Schema>
  required?: string[]
  additionalProperties?: Schema
  allOf?: Schema[]
  anyOf?: Schema[]
  oneOf?: Schema[]
  not?: Schema
}

export type Schema = SchemaObject | boolean

interface MediaTypeObject {
  schema?: Schema
}

interface ParameterObject {
  $ref?: string
  name?: string
  in?: string
  required?: boolean
}

interface RequestBodyObject {
  $ref?: string
  required?: boolean
  content?: Record<string, MediaTypeObject>
}

interface ResponseObject {
  $ref?: string
  description?: string
  content?: Record<string, MediaTypeObject>
}

export interface OperationObject {
  parameters?: ParameterObject[]
  requestBody?: RequestBodyObject
  responses?: Record<string, ResponseObject>
}

type Method = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

export type PathItemObject = { [M in Method]?: OperationObject } & {
  parameters?: ParameterObject[]
}

/** What this validator reads of an OpenAPI 3.0 or 3.1 document. */
export interface OpenApiDocument {
  openapi: string
  servers?: { url: string }[]
  paths: Record<string, PathItemObject>
  components?: Record<string, unknown>
}

export interface OpenApiOptions {
  /** What to check. Defaults to `'both'`. */
  validate?: 'requests' | 'responses' | 'both'
  /**
   * When true (the default), a mocked request that no operation in the document
   * describes is itself a failure — the mock is answering an endpoint the API
   * does not have.
   */
  strict?: boolean
}

const METHODS: Method[] = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

interface Operation {
  method: string
  path: string
  pattern: CompiledPattern
  definition: OperationObject & { parameters: ParameterObject[] }
}

function serverBase(doc: OpenApiDocument): string {
  const url = doc.servers?.[0]?.url ?? ''
  // Absolute or relative; only the path counts, since a pattern matches any origin.
  const path = /^[a-z]+:\/\//i.test(url) ? new URL(url).pathname : url
  return path.replace(/\/$/, '')
}

/**
 * A validator for `mock(env, { validators: [openApi(doc)] })` — or pass the
 * document as `openapi` and this is built for you.
 */
export function openApi(doc: OpenApiDocument, options?: OpenApiOptions): ExchangeValidator {
  const base = serverBase(doc)
  const operations: Operation[] = []
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const definition = item[method]
      if (definition === undefined) continue
      operations.push({
        method: method.toUpperCase(),
        path,
        pattern: compilePattern(`${base}${path}`),
        definition: {
          ...definition,
          parameters: [...(item.parameters ?? []), ...(definition.parameters ?? [])],
        },
      })
    }
  }
  // Literal segments before templated ones, so `/users/me` wins over `/users/{id}`.
  operations.sort((a, b) => (a.path.match(/\{/g)?.length ?? 0) - (b.path.match(/\{/g)?.length ?? 0))

  const mode = options?.validate ?? 'both'
  const strict = options?.strict ?? true
  const find = (request: MockRequest): Operation | undefined =>
    operations.find(op => op.method === request.method && op.pattern.match(request.url) !== null)
  const label = (request: MockRequest): string => `${request.method} ${request.url.pathname}`
  const missing = (request: MockRequest): string[] =>
    strict ? [`no operation in the OpenAPI document matches ${label(request)}`] : []

  return {
    name: 'OpenAPI',
    validateRequest(request) {
      if (mode === 'responses') return []
      const op = find(request)
      if (op === undefined) return missing(request)
      const problems: string[] = []
      for (const param of op.definition.parameters) {
        const resolved = resolveRef(doc, param)
        if (
          resolved.in === 'query' &&
          resolved.required === true &&
          resolved.name !== undefined &&
          request.query[resolved.name] === undefined
        ) {
          problems.push(
            `${op.method} ${op.path}: required query parameter "${resolved.name}" is missing`,
          )
        }
      }
      const body = op.definition.requestBody && resolveRef(doc, op.definition.requestBody)
      if (body !== undefined) {
        const schema = jsonSchemaOf(body.content)
        if (request.rawBody === null || bodyText(request.rawBody) === '') {
          if (body.required === true)
            problems.push(`${op.method} ${op.path}: request body is required`)
        } else if (schema !== undefined) {
          for (const issue of validateSchema(doc, schema, request.body, '')) {
            problems.push(`${op.method} ${op.path} request body${issue}`)
          }
        }
      }
      return problems
    },
    validateReply(request, reply) {
      if (mode === 'requests' || reply.fault !== undefined || reply.passthrough === true) return []
      const op = find(request)
      if (op === undefined) return missing(request)
      const responses = op.definition.responses ?? {}
      const status = String(reply.status)
      const declared = responses[status] ?? responses[`${status[0]}XX`] ?? responses['default']
      if (declared === undefined) {
        return [`${op.method} ${op.path}: status ${status} is not documented`]
      }
      const response = resolveRef(doc, declared)
      const schema = jsonSchemaOf(response.content)
      if (schema === undefined) return []
      const type = reply.headers['content-type'] ?? ''
      if (!/json/i.test(type)) return []
      let value: unknown
      try {
        value = JSON.parse(reply.body === null ? 'null' : bodyText(reply.body))
      } catch {
        return [`${op.method} ${op.path} ${status}: body is not valid JSON`]
      }
      return validateSchema(doc, schema, value, '').map(
        issue => `${op.method} ${op.path} ${status} response${issue}`,
      )
    },
  }
}

function jsonSchemaOf(content: Record<string, MediaTypeObject> | undefined): Schema | undefined {
  if (content === undefined) return undefined
  const key =
    Object.keys(content).find(type => /json/i.test(type)) ??
    Object.keys(content).find(type => type === '*/*')
  return key === undefined ? undefined : content[key]?.schema
}

function resolveRef<T>(doc: OpenApiDocument, value: T): T {
  let current: unknown = value
  for (
    let depth = 0;
    current !== null && typeof current === 'object' && '$ref' in current;
    depth++
  ) {
    const ref = String((current as { $ref: unknown }).$ref)
    if (depth > 32) throw new Error(`harnessed: $ref cycle at ${ref}`)
    if (!ref.startsWith('#/'))
      throw new Error(`harnessed: only local $refs are supported, got ${ref}`)
    current = ref
      .slice(2)
      .split('/')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[part.replace(/~1/g, '/').replace(/~0/g, '~')]
            : undefined,
        doc,
      )
    if (current === undefined) throw new Error(`harnessed: $ref ${ref} does not resolve`)
  }
  return current as T
}

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

const FORMATS: Record<string, RegExp> = {
  'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i,
  date: /^\d{4}-\d{2}-\d{2}$/,
  email: /^[^@\s]+@[^@\s]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  uri: /^[a-z][a-z0-9+.-]*:/i,
}

/** Returns issues as `" at /path: message"` suffixes. */
export function validateSchema(
  doc: OpenApiDocument,
  input: Schema,
  value: unknown,
  at: string,
): string[] {
  const schema = resolveRef(doc, input)
  if (schema === true) return []
  if (schema === false) return [` at ${at || '/'}: no value is allowed here`]
  const here = (message: string): string => ` at ${at || '/'}: ${message}`
  const passes = (part: Schema): boolean => validateSchema(doc, part, value, at).length === 0
  const issues: string[] = []

  if (value === null && schema.nullable === true) return []

  for (const part of schema.allOf ?? []) issues.push(...validateSchema(doc, part, value, at))
  if (schema.anyOf !== undefined && !schema.anyOf.some(passes)) {
    issues.push(here('matches none of anyOf'))
  }
  if (schema.oneOf !== undefined) {
    const passing = schema.oneOf.filter(passes).length
    if (passing !== 1) issues.push(here(`matches ${passing} of oneOf, expected exactly 1`))
  }
  if (schema.not !== undefined && passes(schema.not))
    issues.push(here('matches a schema it must not'))

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    const actual = typeOf(value)
    const ok = types.some(type => type === actual || (type === 'number' && actual === 'integer'))
    if (!ok) return [...issues, here(`expected ${types.join(' or ')}, got ${actual}`)]
  }
  if (schema.enum !== undefined && !schema.enum.some(item => deepEqual(item, value))) {
    issues.push(here(`${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`))
  }
  if ('const' in schema && !deepEqual(schema.const, value)) {
    issues.push(here(`expected ${JSON.stringify(schema.const)}`))
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push(here(`shorter than ${schema.minLength}`))
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      issues.push(here(`longer than ${schema.maxLength}`))
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) {
      issues.push(here(`does not match ${schema.pattern}`))
    }
    const format = schema.format === undefined ? undefined : FORMATS[schema.format]
    if (format !== undefined && !format.test(value)) {
      issues.push(here(`is not a valid ${schema.format}`))
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push(here(`below minimum ${schema.minimum}`))
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push(here(`above maximum ${schema.maximum}`))
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      issues.push(here(`not above ${schema.exclusiveMinimum}`))
    }
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
      issues.push(here(`not below ${schema.exclusiveMaximum}`))
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issues.push(here(`fewer than ${schema.minItems} items`))
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      issues.push(here(`more than ${schema.maxItems} items`))
    }
    const items = schema.items
    if (items !== undefined && !Array.isArray(items)) {
      value.forEach((item, index) =>
        issues.push(...validateSchema(doc, items, item, `${at}/${index}`)),
      )
    }
  }
  if (typeOf(value) === 'object') {
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (!(key in record)) issues.push(here(`missing required property "${key}"`))
    }
    const properties = schema.properties ?? {}
    const additional = schema.additionalProperties
    for (const [key, item] of Object.entries(record)) {
      const declared = properties[key]
      if (declared !== undefined) {
        issues.push(...validateSchema(doc, declared, item, `${at}/${key}`))
      } else if (additional === false) {
        issues.push(here(`unexpected property "${key}"`))
      } else if (typeof additional === 'object') {
        issues.push(...validateSchema(doc, additional, item, `${at}/${key}`))
      }
    }
  }
  return issues
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ------------------------------------------------------------- typed routes

/** Paths of an openapi-typescript `paths` type that declare `method`. */
export type PathsWith<Paths, Method extends string> = {
  [P in keyof Paths]: Paths[P] extends Record<Method, infer Op>
    ? Op extends undefined | never
      ? never
      : P
    : never
}[keyof Paths] &
  string

type OperationOf<Paths, P extends keyof Paths, Method extends string> =
  Paths[P] extends Record<Method, infer Op> ? Op : never

/** Path params declared by an operation, as strings — the way they arrive in a URL. */
export type OpenApiParams<Op> = Op extends { parameters: { path: infer P } }
  ? P extends Record<string, unknown>
    ? { [K in keyof P]: string }
    : Record<never, never>
  : Record<never, never>

/** The JSON body of an operation's success responses. */
export type OpenApiResponse<Op> = Op extends { responses: infer R }
  ? {
      [S in keyof R]: S extends 200 | 201 | 202 | 203 | 206 | '200' | '201' | '2XX' | 'default'
        ? R[S] extends { content: { 'application/json': infer B } }
          ? B
          : never
        : never
    }[keyof R]
  : unknown

export type OpenApiRequestBody<Op> = Op extends {
  requestBody?: { content: { 'application/json': infer B } }
}
  ? B
  : unknown

export type { OperationOf }
