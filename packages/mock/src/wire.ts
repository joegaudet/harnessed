/**
 * Requests and results as JSON, for transports that reach a page over a
 * string channel. Binary bodies travel as base64.
 */
import { REPLY } from './types'
import type { DispatchResult } from './transport'
import type { MockReply, RawRequest } from './types'

type WireBody = { text: string } | { base64: string } | null

export interface WireRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: WireBody
  kind?: RawRequest['kind']
}

export type WireResult =
  | { kind: 'passthrough' }
  | { kind: 'error'; fault: 'network-error' | 'abort' }
  | {
      kind: 'reply'
      status: number
      statusText?: string
      headers: Record<string, string>
      body: WireBody
      chunks?: { data: WireBody; delay: number }[]
    }

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function encodeBody(body: string | Uint8Array | null): WireBody {
  if (body === null) return null
  return typeof body === 'string' ? { text: body } : { base64: toBase64(body) }
}

function decodeBody(body: WireBody): string | Uint8Array | null {
  if (body === null) return null
  return 'text' in body ? body.text : fromBase64(body.base64)
}

export function encodeRequest(request: RawRequest): WireRequest {
  const wire: WireRequest = {
    method: request.method,
    url: request.url,
    headers: request.headers,
    body: encodeBody(request.body),
  }
  if (request.kind !== undefined) wire.kind = request.kind
  return wire
}

export function decodeRequest(wire: WireRequest): RawRequest {
  const request: RawRequest = {
    method: wire.method,
    url: wire.url,
    headers: wire.headers,
    body: decodeBody(wire.body),
  }
  if (wire.kind !== undefined) request.kind = wire.kind
  return request
}

export function encodeResult(result: DispatchResult): WireResult {
  if (result.kind !== 'reply') return result
  const { reply } = result
  const wire: WireResult = {
    kind: 'reply',
    status: reply.status,
    headers: reply.headers,
    body: encodeBody(reply.body),
  }
  if (reply.statusText !== undefined) wire.statusText = reply.statusText
  if (reply.chunks !== undefined) {
    wire.chunks = reply.chunks.map(chunk => ({ data: encodeBody(chunk.data), delay: chunk.delay }))
  }
  return wire
}

export function decodeResult(wire: WireResult): DispatchResult {
  if (wire.kind !== 'reply') return wire
  const reply: MockReply = {
    [REPLY]: true,
    status: wire.status,
    headers: wire.headers,
    body: decodeBody(wire.body),
  }
  if (wire.statusText !== undefined) reply.statusText = wire.statusText
  if (wire.chunks !== undefined) {
    reply.chunks = wire.chunks.map(chunk => ({
      data: decodeBody(chunk.data) ?? '',
      delay: chunk.delay,
    }))
  }
  return { kind: 'reply', reply }
}
