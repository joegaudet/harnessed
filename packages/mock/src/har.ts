import { reply } from './builders'
import { HANDLER } from './handler'
import type { HandlerDefinition } from './handler'
import { bodyText } from './request'
import type { ObservedExchange } from './transport'
import type { MockRequest } from './types'

/** The subset of HAR 1.2 this package reads and writes. */
export interface Har {
  log: {
    version: string
    creator: { name: string; version: string }
    entries: HarEntry[]
  }
}

export interface HarEntry {
  startedDateTime: string
  time: number
  request: {
    method: string
    url: string
    httpVersion: string
    headers: { name: string; value: string }[]
    queryString: { name: string; value: string }[]
    postData?: { mimeType: string; text: string }
    headersSize: number
    bodySize: number
    cookies: unknown[]
  }
  response: {
    status: number
    statusText: string
    httpVersion: string
    headers: { name: string; value: string }[]
    content: { size: number; mimeType: string; text?: string; encoding?: 'base64' }
    redirectURL: string
    headersSize: number
    bodySize: number
    cookies: unknown[]
  }
  cache: Record<string, never>
  timings: { send: number; wait: number; receive: number }
}

export interface FromHarOptions {
  /**
   * `'url'` (the default) answers by method and full URL; `'url+body'` also
   * requires the request body to equal the recorded one.
   */
  match?: 'url' | 'url+body'
  /** Only replay entries whose URL this accepts — e.g. to leave assets alone. */
  filter?: (url: string) => boolean
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function bytesToBase64(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Compiles a HAR into handlers. Repeated requests replay in recorded order: each
 * entry answers once, and the last one for a URL keeps answering.
 */
export function harHandlers(har: Har, options?: FromHarOptions): HandlerDefinition[] {
  const entries = har.log.entries.filter(entry => options?.filter?.(entry.request.url) ?? true)
  const seen = new Map<string, number>()
  const total = new Map<string, number>()
  const keyOf = (entry: HarEntry): string =>
    `${entry.request.method} ${entry.request.url.split('#')[0]}${
      options?.match === 'url+body' ? ` ${entry.request.postData?.text ?? ''}` : ''
    }`
  for (const entry of entries) total.set(keyOf(entry), (total.get(keyOf(entry)) ?? 0) + 1)

  const handlers = entries.map(entry => {
    const key = keyOf(entry)
    const index = (seen.get(key) ?? 0) + 1
    seen.set(key, index)
    const href = entry.request.url.split('#')[0]!
    const content = entry.response.content
    const body =
      content.text === undefined
        ? null
        : content.encoding === 'base64'
          ? base64ToBytes(content.text)
          : content.text
    const headers = Object.fromEntries(
      entry.response.headers
        .filter(({ name }) => !/^(content-length|content-encoding|transfer-encoding)$/i.test(name))
        .map(({ name, value }) => [name.toLowerCase(), value]),
    )
    const recorded = reply(body, content.mimeType || undefined, {
      status: entry.response.status,
      headers,
    })
    const predicates =
      options?.match === 'url+body'
        ? [
            (request: MockRequest) =>
              bodyText(request.rawBody) === (entry.request.postData?.text ?? ''),
          ]
        : []
    const definition: HandlerDefinition = {
      [HANDLER]: true,
      method: entry.request.method.toUpperCase(),
      pattern: new RegExp(`^${escapeRegExp(href)}$`),
      respond: recorded,
      name: `HAR ${entry.request.method} ${href}`,
      predicates,
      // Every entry but the last for its URL answers once, in recorded order.
      ...(index < total.get(key)! ? { times: 1 } : {}),
    }
    return definition
  })
  // Last registered wins, so the earliest entry has to sit on top.
  return handlers.reverse()
}

function pairs(record: Record<string, string>): { name: string; value: string }[] {
  return Object.entries(record).map(([name, value]) => ({ name, value }))
}

/** Builds a HAR from observed exchanges. */
export function toHar(exchanges: readonly ObservedExchange[]): Har {
  return {
    log: {
      version: '1.2',
      creator: { name: '@harnessed-ts/mock', version: '1' },
      entries: exchanges.map(exchange => {
        const url = new URL(exchange.request.url)
        const requestText =
          exchange.request.body === null ? undefined : bodyText(exchange.request.body)
        const mimeType = exchange.headers['content-type'] ?? ''
        const isText = /^(text\/|application\/(json|xml|javascript|[a-z.+-]*\+(json|xml)))/i.test(
          mimeType,
        )
        const content: HarEntry['response']['content'] =
          exchange.body === null
            ? { size: 0, mimeType }
            : typeof exchange.body === 'string'
              ? { size: exchange.body.length, mimeType, text: exchange.body }
              : isText
                ? { size: exchange.body.length, mimeType, text: bodyText(exchange.body) }
                : {
                    size: exchange.body.length,
                    mimeType,
                    text: bytesToBase64(exchange.body),
                    encoding: 'base64',
                  }
        const entry: HarEntry = {
          startedDateTime: new Date(exchange.startedAt).toISOString(),
          time: exchange.durationMs,
          request: {
            method: exchange.request.method.toUpperCase(),
            url: url.href,
            httpVersion: 'HTTP/1.1',
            headers: pairs(exchange.request.headers),
            queryString: [...url.searchParams].map(([name, value]) => ({ name, value })),
            headersSize: -1,
            bodySize: requestText?.length ?? 0,
            cookies: [],
          },
          response: {
            status: exchange.status,
            statusText: exchange.statusText,
            httpVersion: 'HTTP/1.1',
            headers: pairs(exchange.headers),
            content,
            redirectURL: exchange.headers['location'] ?? '',
            headersSize: -1,
            bodySize: content.size,
            cookies: [],
          },
          cache: {},
          timings: { send: 0, wait: exchange.durationMs, receive: 0 },
        }
        if (requestText !== undefined) {
          entry.request.postData = {
            mimeType: exchange.request.headers['content-type'] ?? '',
            text: requestText,
          }
        }
        return entry
      }),
    },
  }
}
