import { describe, expect, it } from 'vitest'
import { compilePattern } from '../src'

const match = (pattern: string | RegExp, url: string, base?: string) =>
  compilePattern(pattern, base).match(new URL(url))

describe('compilePattern', () => {
  it('matches a relative path on any origin, with params', () => {
    expect(match('/users/:id', 'http://localhost/users/7')).toEqual({ id: '7' })
    expect(match('/users/:id', 'https://api.example.com/users/ada%20b')).toEqual({ id: 'ada b' })
    expect(match('/users/:id', 'http://localhost/users/7/posts')).toBeNull()
  })

  it('ignores the query string and a trailing slash', () => {
    expect(match('/users', 'http://localhost/users/?page=2')).toEqual({})
  })

  it('takes OpenAPI-style {params}', () => {
    expect(match('/users/{id}/posts/{post}', 'http://x/users/1/posts/2')).toEqual({
      id: '1',
      post: '2',
    })
  })

  it('pins the origin of an absolute pattern', () => {
    expect(match('https://api.example.com/users', 'https://api.example.com/users')).toEqual({})
    expect(match('https://api.example.com/users', 'https://other.example.com/users')).toBeNull()
    expect(match('https://*.example.com/users', 'https://eu.example.com/users')).toEqual({})
  })

  it('globs: * within a segment, ** across them', () => {
    expect(match('/api/*/items', 'http://x/api/v1/items')).toEqual({})
    expect(match('/api/*/items', 'http://x/api/v1/v2/items')).toBeNull()
    expect(match('/api/**', 'http://x/api/v1/v2/items')).toEqual({})
    expect(match('/api/**', 'http://x/api')).toEqual({})
    expect(match('**/graphql', 'http://x/v2/graphql')).toEqual({})
    expect(match('/api/**', 'http://x/apix')).toBeNull()
  })

  it('tests a RegExp against the whole URL, named groups as params', () => {
    expect(match(/\/users\/(?<id>\d+)$/, 'http://x/users/12')).toEqual({ id: '12' })
    expect(match(/\/users\/\d+$/, 'http://x/users/ab')).toBeNull()
  })

  it('resolves relative patterns against a baseUrl', () => {
    expect(
      match('/users', 'https://api.example.com/v2/users', 'https://api.example.com/v2'),
    ).toEqual({})
    expect(match('/users', 'http://localhost/v2/users', 'https://api.example.com/v2')).toBeNull()
  })
})
