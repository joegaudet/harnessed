/**
 * The transport for runners whose tests share the page's realm and have no
 * network hook of their own: jsdom (Testing Library), Ember's test runners,
 * Vitest browser mode and Storybook. It patches `fetch`, `XMLHttpRequest` and,
 * when a socket is mocked, `WebSocket`, through `@mswjs/interceptors`.
 *
 * Kept in its own entry point so only drivers that need it pull the
 * interceptors in — and so they are an optional peer dependency rather than a
 * cost every user pays.
 */
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { WebSocketInterceptor } from '@mswjs/interceptors/WebSocket'
// The web variant proxies the XHR object itself. The Node default hooks the
// `http` module underneath jsdom's XHR, which jsdom 30 no longer answers through.
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest/web'
import type { EnvConfig } from '@harnessed-ts/core'
import type { Dispatcher, DispatchResult, InstalledTransport, MockTransport } from './transport'
import type { MockReply, RawRequest } from './types'

export const IN_PAGE_CAPABILITIES = {
  streaming: true,
  websockets: true,
  harRecord: false,
} as const

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

async function readRequest(request: Request, kind: RawRequest['kind']): Promise<RawRequest> {
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

interface Controller {
  respondWith(response: Response): void
  errorWith(reason?: unknown): void
}

function answer(controller: Controller, result: DispatchResult): void {
  if (result.kind === 'passthrough') return
  if (result.kind === 'error') {
    if (result.fault === 'abort')
      controller.errorWith(new DOMException('The request was aborted', 'AbortError'))
    else controller.respondWith(Response.error())
    return
  }
  controller.respondWith(toResponse(result.reply))
}

/**
 * Only one set of interceptors can patch a realm. A second `install` for the
 * same realm (two mocks, or a dispose racing a new mock) shares it.
 */
let active: { dispatcher: Dispatcher; teardown: () => void } | undefined

/**
 * The in-page transport. `key` decides which envs share a mock; the default,
 * the realm itself, is right for every runner that has one page per test file.
 */
export function inPageTransport(options?: { key?: (env: EnvConfig) => object }): MockTransport {
  return {
    capabilities: IN_PAGE_CAPABILITIES,
    key: options?.key ?? (() => globalThis),
    async install(_env, dispatcher): Promise<InstalledTransport> {
      active?.teardown()
      const fetchInterceptor = new FetchInterceptor()
      const xhrInterceptor = new XMLHttpRequestInterceptor()
      let sockets: WebSocketInterceptor | undefined

      const listen =
        (kind: RawRequest['kind']) =>
        async ({
          request,
          controller,
        }: {
          request: Request
          controller: Controller
        }): Promise<void> => {
          const result = await dispatcher.dispatch(await readRequest(request, kind))
          answer(controller, result)
        }
      fetchInterceptor.on('request', listen('fetch'))
      xhrInterceptor.on('request', listen('xhr'))
      fetchInterceptor.apply()
      xhrInterceptor.apply()

      const enableSockets = (): void => {
        if (sockets !== undefined || !dispatcher.hasWebSockets()) return
        sockets = new WebSocketInterceptor()
        sockets.on('connection', ({ client, server }) => {
          const target = dispatcher.connect(client.url.href)
          if (target === undefined) {
            server.connect()
            return
          }
          client.addEventListener('message', event => {
            const data = event.data
            target.message(typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer))
          })
          client.addEventListener('close', event => target.closed(event.code, event.reason))
          target.open({
            send: data => client.send(data as string),
            close: (code, reason) => client.close(code, reason),
          })
        })
        sockets.apply()
      }
      enableSockets()

      const teardown = (): void => {
        fetchInterceptor.dispose()
        xhrInterceptor.dispose()
        sockets?.dispose()
        if (active?.teardown === teardown) active = undefined
      }
      active = { dispatcher, teardown }

      return {
        async dispose() {
          teardown()
        },
        async webSocketsChanged() {
          enableSockets()
        },
      }
    },
  }
}
