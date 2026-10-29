/**
 * The WebSocket shim itself, in a module of its own with no imports: it is
 * bundled into the page script `wsShimScript` returns, and into the page agent.
 */

/**
 * Runs in the page, and may use only its argument and the page's globals.
 * `postGlobal` names the function the page posts through.
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
