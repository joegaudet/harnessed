/**
 * WebSocket mocking for runners with no socket hook of their own (Puppeteer,
 * WebdriverIO, TestCafe, Cypress). A shim replaces `WebSocket` in the page and
 * talks to the test process over two one-way channels the transport supplies:
 * the page posts JSON strings to a global function, and the test process
 * delivers JSON strings back through `window.__harnessedWs`. A socket no route
 * matches is handed a real `WebSocket`, so the app's other sockets (a dev
 * server's, say) keep working.
 *
 * Messages travel as strings; a binary frame from a mock arrives as text.
 */
import type { Dispatcher } from './transport'
import type { WsConnectionTarget } from './ws'
// Bundled to text at build time, so the shim reaches the page as compiled
// here: a consumer's bundler re-transpiling `wsShim.toString()` (Cypress's
// webpack does) would leave it calling helpers the page does not have.
import shimPage from './ws-shim-page?bundle'

export { wsShim } from './ws-shim'

/** What ws-shim-page.ts reads the post global's name from. */
const POST_PARAMETER = '__HARNESSED_WS_POST__'

/** The page global the test process delivers through. */
export const WS_DELIVER_GLOBAL = '__harnessedWs'

type PageMessage =
  | { type: 'connect'; id: number; url: string }
  | { type: 'message'; id: number; data: string }
  | { type: 'close'; id: number; code: number; reason: string }

type TestMessage =
  | { type: 'accept' | 'passthrough'; id: number }
  | { type: 'message'; id: number; data: string }
  | { type: 'close'; id: number; code?: number; reason?: string }

/** The shim as a script that installs itself, posting through `postGlobal`. */
export function wsShimScript(postGlobal: string): string {
  return `(function (${POST_PARAMETER}) {${shimPage}})(${JSON.stringify(postGlobal)});`
}

/**
 * The test-process side: routes the page's sockets to `api.ws()` routes, and
 * hands back to the page the ones no route claims.
 */
export class WsBridge {
  readonly #dispatcher: Dispatcher
  readonly #deliver: (raw: string) => Promise<void>
  readonly #targets = new Map<number, WsConnectionTarget>()

  /** `deliver` runs `window.__harnessedWs(raw)` in the page. */
  constructor(dispatcher: Dispatcher, deliver: (raw: string) => Promise<void>) {
    this.#dispatcher = dispatcher
    this.#deliver = deliver
  }

  #send(message: TestMessage): Promise<void> {
    return this.#deliver(JSON.stringify(message)).catch(() => {
      // The page went away under the socket; nothing is left to tell.
    })
  }

  /** Feed every string the page posts through here. */
  receive(raw: string): void {
    const message = JSON.parse(raw) as PageMessage
    if (message.type === 'connect') {
      const target = this.#dispatcher.connect(message.url)
      if (target === undefined) {
        void this.#send({ type: 'passthrough', id: message.id })
        return
      }
      this.#targets.set(message.id, target)
      const id = message.id
      void this.#send({ type: 'accept', id }).then(() =>
        target.open({
          send: data => {
            void this.#send({
              type: 'message',
              id,
              data: typeof data === 'string' ? data : new TextDecoder().decode(data),
            })
          },
          close: (code, reason) => {
            this.#targets.delete(id)
            void this.#send({
              type: 'close',
              id,
              ...(code === undefined ? {} : { code }),
              ...(reason === undefined ? {} : { reason }),
            })
          },
        }),
      )
    } else if (message.type === 'message') {
      this.#targets.get(message.id)?.message(message.data)
    } else {
      this.#targets.get(message.id)?.closed(message.code, message.reason)
      this.#targets.delete(message.id)
    }
  }
}
