import { compilePattern } from './url-pattern'
import type { CompiledPattern, UrlPattern } from './url-pattern'

export type WsData = string | Uint8Array

/** The app's end of a socket, as the mock holds it: send to it, or close it. */
export interface WsClientSide {
  send(data: WsData): void
  close(code?: number, reason?: string): void
}

/**
 * What a transport drives once the app opens a socket that a route matched. The
 * transport calls `open` with a way to reach the app, then forwards what the
 * app sends and when it closes.
 */
export interface WsConnectionTarget {
  open(client: WsClientSide): void
  message(data: WsData): void
  closed(code: number, reason: string): void
}

/** One open socket from the app. */
export interface WsConnection {
  readonly url: string
  /** Messages the app sent on this connection, oldest first. */
  readonly received: readonly WsData[]
  readonly open: boolean
  send(data: WsData | object): void
  close(code?: number, reason?: string): void
}

type ConnectionListener = (connection: WsConnection) => void | Promise<void>
type MessageListener = (data: WsData, connection: WsConnection) => void | Promise<void>

/**
 * A mocked WebSocket endpoint. The app connects to it as to a real server; the
 * test pushes messages and reacts to the app's.
 *
 * ```ts
 * const live = api.ws('wss://example.com/live')
 * live.onMessage((data, socket) => socket.send(`echo:${data}`))
 * await live.waitForConnection()
 * live.send({ type: 'price', value: 42 })
 * ```
 */
export class WsRoute {
  readonly pattern: CompiledPattern
  readonly #connections: WsConnection[] = []
  readonly #onConnection: ConnectionListener[] = []
  readonly #onMessage: MessageListener[] = []
  readonly #waiters = new Set<() => void>()

  constructor(pattern: UrlPattern, baseUrl?: string) {
    this.pattern = compilePattern(pattern, baseUrl)
  }

  get connections(): readonly WsConnection[] {
    return this.#connections
  }

  /** Every message the app sent, across connections. */
  get received(): readonly WsData[] {
    return this.#connections.flatMap(connection => connection.received)
  }

  onConnection(listener: ConnectionListener): this {
    this.#onConnection.push(listener)
    return this
  }

  onMessage(listener: MessageListener): this {
    this.#onMessage.push(listener)
    return this
  }

  /** Sends to every open connection. Objects are sent as JSON. */
  send(data: WsData | object): void {
    for (const connection of this.#connections) if (connection.open) connection.send(data)
  }

  close(code?: number, reason?: string): void {
    for (const connection of this.#connections) if (connection.open) connection.close(code, reason)
  }

  /** Resolves with the first connection, or the next one if `fresh`. */
  waitForConnection(options?: { timeout?: number; fresh?: boolean }): Promise<WsConnection> {
    const index = options?.fresh === true ? this.#connections.length : 0
    return this.#waitUntil(
      () => this.#connections[index],
      options?.timeout ?? 5_000,
      'a WebSocket connection',
    )
  }

  /** Resolves with the first message from the app that satisfies `matches`. */
  waitForMessage(
    matches: (data: WsData) => boolean = () => true,
    options?: { timeout?: number },
  ): Promise<WsData> {
    return this.#waitUntil(
      () => this.received.find(matches),
      options?.timeout ?? 5_000,
      'a WebSocket message',
    )
  }

  #waitUntil<T>(read: () => T | undefined, timeout: number, what: string): Promise<T> {
    const now = read()
    if (now !== undefined) return Promise.resolve(now)
    return new Promise<T>((resolve, reject) => {
      const check = (): void => {
        const value = read()
        if (value === undefined) return
        cleanup()
        resolve(value)
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(
          new Error(
            `harnessed: timed out after ${timeout}ms waiting for ${what} on ${this.pattern.source}`,
          ),
        )
      }, timeout)
      const cleanup = (): void => {
        clearTimeout(timer)
        this.#waiters.delete(check)
      }
      this.#waiters.add(check)
    })
  }

  #notify(): void {
    for (const waiter of [...this.#waiters]) waiter()
  }

  /** The transport-facing side of one new connection. */
  accept(url: string, report: (error: unknown) => void): WsConnectionTarget {
    const received: WsData[] = []
    let client: WsClientSide | undefined
    let open = false
    const pending: WsData[] = []
    const connection: WsConnection = {
      url,
      received,
      get open() {
        return open
      },
      send(data) {
        const payload =
          typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data)
        if (client === undefined) pending.push(payload)
        else client.send(payload)
      },
      close(code, reason) {
        open = false
        client?.close(code, reason)
      },
    }
    const run = (work: () => void | Promise<void>): void => {
      try {
        Promise.resolve(work()).catch(report)
      } catch (error) {
        report(error)
      }
    }
    return {
      open: side => {
        client = side
        open = true
        for (const data of pending.splice(0)) side.send(data)
        this.#connections.push(connection)
        for (const listener of this.#onConnection) run(() => listener(connection))
        this.#notify()
      },
      message: data => {
        received.push(data)
        for (const listener of this.#onMessage) run(() => listener(data, connection))
        this.#notify()
      },
      closed: () => {
        open = false
        this.#notify()
      },
    }
  }
}
