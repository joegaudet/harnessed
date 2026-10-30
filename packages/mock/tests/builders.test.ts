import { describe, expect, it } from 'vitest'
import {
  bytes,
  chunked,
  created,
  formData,
  gqlData,
  gqlErrors,
  html,
  json,
  jsonApi,
  ndjson,
  networkError,
  noContent,
  notFound,
  problem,
  redirect,
  sse,
  text,
  tooManyRequests,
  urlencoded,
  validationProblem,
  withCors,
  xml,
} from '../src'

describe('builders', () => {
  it('sets content types and status', () => {
    expect(json({ a: 1 })).toMatchObject({
      status: 200,
      body: '{"a":1}',
      headers: { 'content-type': 'application/json' },
    })
    expect(text('hi').headers['content-type']).toMatch(/^text\/plain/)
    expect(html('<p>').headers['content-type']).toMatch(/^text\/html/)
    expect(xml('<a/>').headers['content-type']).toMatch(/^application\/xml/)
    expect(json(null).body).toBe('null')
  })

  it('takes status, headers and cookies in init', () => {
    const reply = json({}, { status: 201, headers: { ETag: '"v1"' }, cookies: { a: '1', b: '2' } })
    expect(reply.status).toBe(201)
    expect(reply.headers['etag']).toBe('"v1"')
    expect(reply.headers['set-cookie']).toBe('a=1\nb=2')
  })

  it('status shortcuts', () => {
    expect(created({ id: 1 })).toMatchObject({ status: 201, body: '{"id":1}' })
    expect(noContent()).toMatchObject({ status: 204, body: null })
    expect(notFound().status).toBe(404)
    expect(redirect('/login').headers['location']).toBe('/login')
    expect(tooManyRequests(30).headers['retry-after']).toBe('30')
  })

  it('problem details per RFC 9457', () => {
    const reply = problem({ status: 403, title: 'Forbidden', detail: 'No' })
    expect(reply.status).toBe(403)
    expect(reply.headers['content-type']).toBe('application/problem+json')
    expect(JSON.parse(reply.body as string)).toEqual({
      type: 'about:blank',
      status: 403,
      title: 'Forbidden',
      detail: 'No',
    })
    expect(JSON.parse(validationProblem({ email: 'taken' }).body as string).errors).toEqual({
      email: ['taken'],
    })
  })

  it('binary and forms', () => {
    const reply = bytes(new Uint8Array([1, 2]), { filename: 'a.bin' })
    expect(reply.headers['content-disposition']).toBe('attachment; filename="a.bin"')
    expect(urlencoded({ a: '1', b: ['2', '3'] }).body).toBe('a=1&b=2&b=3')
    expect(formData({ name: 'Ada' }).body).toContain('name="name"\r\n\r\nAda')
  })

  it('streams: sse, ndjson and chunked carry timed chunks', () => {
    const events = sse([{ event: 'tick', data: { n: 1 } }, 'done'], { interval: 10 })
    expect(events.headers['content-type']).toBe('text/event-stream')
    expect(events.chunks).toEqual([
      { data: 'event: tick\ndata: {"n":1}\n\n', delay: 0 },
      { data: 'data: done\n\n', delay: 10 },
    ])
    expect(events.body).toBe('event: tick\ndata: {"n":1}\n\ndata: done\n\n')
    expect(ndjson([1, 2]).body).toBe('1\n2\n')
    expect(chunked(['a', 'b']).chunks).toHaveLength(2)
  })

  it('JSON:API documents', () => {
    const doc = JSON.parse(
      jsonApi.resource(
        'users',
        { id: 1, name: 'Ada' },
        { relationships: { team: { type: 'teams', id: '9' } } },
      ).body as string,
    )
    expect(doc).toEqual({
      data: {
        type: 'users',
        id: '1',
        attributes: { name: 'Ada' },
        relationships: { team: { data: { type: 'teams', id: '9' } } },
      },
    })
    expect(jsonApi.collection('users', [{ id: 1 }]).headers['content-type']).toBe(
      'application/vnd.api+json',
    )
    const errors = jsonApi.errors([
      { status: 422, detail: 'bad', source: { pointer: '/data/attributes/name' } },
    ])
    expect(errors.status).toBe(422)
    expect(JSON.parse(errors.body as string).errors[0].status).toBe('422')
  })

  it('GraphQL results', () => {
    expect(JSON.parse(gqlData({ user: null }).body as string)).toEqual({ data: { user: null } })
    expect(JSON.parse(gqlErrors(['boom'], null).body as string)).toEqual({
      data: null,
      errors: [{ message: 'boom' }],
    })
  })

  it('faults and CORS', () => {
    expect(networkError().fault).toBe('network-error')
    expect(withCors(json({})).headers['access-control-allow-origin']).toBe('*')
  })
})
