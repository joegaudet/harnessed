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

/**
 * Runs in the page. Self-contained on purpose — it is serialised with
 * `toString()` and evaluated there, so it may use only its argument and the
 * page's globals. `postGlobal` names the function the page posts through.
 */
export function wsShim(postGlobal: string): void {
  const page = window as unknown as Record<string, unknown>
  if (typeof page['__harnessedWs'] === 'function') return
  const Real = window.WebSocket
  const sockets = new Map<number, MockSocket>()
  let next = 0
  const post = (message: unknown): void => {
    ;(page[postGlobal] as (raw: string) => void)(JSON.stringify(message))
  }

  class MockSocket extends EventTarget {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    readonly CONNECTING = 0
    readonly OPEN = 1
    readonly CLOSING = 2
    readonly CLOSED = 3
    readonly url: string
    readyState = 0
    protocol = ''
    extensions = ''
    bufferedAmount = 0
    binaryType: BinaryType = 'blob'
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onclose: ((event: CloseEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    readonly id: number
    readonly protocols: string | string[] | undefined
    real: WebSocket | null = null

    constructor(url: string | URL, protocols?: string | string[]) {
      super()
      this.url = new URL(String(url), window.location.href).href.replace(/^http/, 'ws')
      this.protocols = protocols
      this.id = ++next
      sockets.set(this.id, this)
      post({ type: 'connect', id: this.id, url: this.url })
    }

    send(data: unknown): void {
      if (this.real !== null) return this.real.send(data as string)
      if (this.readyState !== 1)
        throw new DOMException('WebSocket is not open', 'InvalidStateError')
      post({ type: 'message', id: this.id, data: String(data) })
    }

    close(code = 1000, reason = ''): void {
      if (this.real !== null) return this.real.close(code, reason)
      if (this.readyState >= 2) return
      this.readyState = 2
      post({ type: 'close', id: this.id, code, reason })
      this.finish(code, reason)
    }

    emit(event: Event): void {
      this.dispatchEvent(event)
      const handler = (this as unknown as Record<string, unknown>)[`on${event.type}`]
      if (typeof handler === 'function') handler.call(this, event)
    }

    finish(code: number, reason: string): void {
      this.readyState = 3
      sockets.delete(this.id)
      this.emit(new CloseEvent('close', { code, reason, wasClean: true }))
    }

    adoptReal(): void {
      const real =
        this.protocols === undefined ? new Real(this.url) : new Real(this.url, this.protocols)
      real.binaryType = this.binaryType
      this.real = real
      for (const type of ['open', 'message', 'close', 'error']) {
        real.addEventListener(type, event => {
          this.readyState = real.readyState
          this.protocol = real.protocol
          const copy =
            type === 'message'
              ? new MessageEvent('message', { data: (event as MessageEvent).data })
              : type === 'close'
                ? new CloseEvent('close', {
                    code: (event as CloseEvent).code,
                    reason: (event as CloseEvent).reason,
                    wasClean: (event as CloseEvent).wasClean,
                  })
                : new Event(type)
          this.emit(copy)
        })
      }
    }
  }

  page['__harnessedWs'] = (raw: string): void => {
    const message = JSON.parse(raw) as {
      type: string
      id: number
      data?: string
      code?: number
      reason?: string
    }
    const socket = sockets.get(message.id)
    if (socket === undefined) return
    if (message.type === 'accept') {
      socket.readyState = 1
      socket.emit(new Event('open'))
    } else if (message.type === 'passthrough') {
      socket.adoptReal()
    } else if (message.type === 'message' && socket.readyState === 1) {
      socket.emit(new MessageEvent('message', { data: message.data }))
    } else if (message.type === 'close' && socket.readyState < 3) {
      socket.finish(message.code ?? 1000, message.reason ?? '')
    }
  }
  page['WebSocket'] = MockSocket
}

/** The shim as a script that installs itself, posting through `postGlobal`. */
export function wsShimScript(postGlobal: string): string {
  return `(${wsShim.toString()})(${JSON.stringify(postGlobal)});`
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
