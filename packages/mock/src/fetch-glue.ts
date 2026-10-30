/**
 * Turning a fetch `Request` into a `RawRequest`, and a `DispatchResult` into
 * what an interceptor's controller answers with. Shared by the in-page
 * transport and the page agent that remote drivers inject — and free of any
 * interceptor import, so either can bundle it.
 */
import type { DispatchResult } from './transport'
import type { MockReply, RawRequest } from './types'

/** Body statuses the Fetch spec forbids a body on. */
const NULL_BODY = new Set([101, 103, 204, 205, 304])

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
}

function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : data
}

/** Builds the `Response` a mocked request resolves with. Exported for transports that run in a page. */
export function toResponse(reply: MockReply, streaming = true): Response {
  const headers = new Headers()
  for (const [key, value] of Object.entries(reply.headers)) {
    if (key === 'set-cookie') for (const cookie of value.split('\n')) headers.append(key, cookie)
    else headers.set(key, value)
  }
  let body: BodyInit | null = null
  if (!NULL_BODY.has(reply.status)) {
    if (streaming && reply.chunks !== undefined && reply.chunks.length > 0) {
      const chunks = reply.chunks
      body = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const chunk of chunks) {
            await sleep(chunk.delay)
            controller.enqueue(toBytes(chunk.data))
          }
          controller.close()
        },
      })
    } else if (reply.body !== null) {
      body = reply.body as BodyInit
    }
  }
  const init: ResponseInit = { status: reply.status, headers }
  if (reply.statusText !== undefined) init.statusText = reply.statusText
  return new Response(body, init)
}

export async function readRequest(request: Request, kind: RawRequest['kind']): Promise<RawRequest> {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })
  let body: Uint8Array | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const buffer = await request.clone().arrayBuffer()
    if (buffer.byteLength > 0) body = new Uint8Array(buffer)
  }
  return { method: request.method, url: request.url, headers, body, kind }
}

export interface Controller {
  respondWith(response: Response): void
  errorWith(reason?: unknown): void
}

export function answer(controller: Controller, result: DispatchResult): void {
  if (result.kind === 'passthrough') return
  if (result.kind === 'error') {
    if (result.fault === 'abort') {
      // An Error named AbortError, not a DOMException: jsdom's DOMException is no
      // Error in Node's realm, and the interceptor then never settles the request.
      controller.errorWith(
        Object.assign(new Error('The request was aborted'), { name: 'AbortError' }),
      )
    } else {
      controller.respondWith(Response.error())
    }
    return
  }
  controller.respondWith(toResponse(result.reply))
}
