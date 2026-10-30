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
import { answer, readRequest } from './fetch-glue'
import type { Controller } from './fetch-glue'
import type { Dispatcher, InstalledTransport, MockTransport } from './transport'
import type { RawRequest } from './types'

export { toResponse } from './fetch-glue'

export const IN_PAGE_CAPABILITIES = {
  streaming: true,
  websockets: true,
  harRecord: false,
} as const

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
