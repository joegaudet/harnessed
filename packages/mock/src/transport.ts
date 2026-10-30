import type { EnvConfig } from '@harnessed-ts/core'
import { globals } from './globals'
import type { MockReply, RawRequest } from './types'
import type { WsConnectionTarget } from './ws'

/**
 * What a runner can do, declared by its transport. Specs and docs read these, so
 * a documented gap is the same fact as a skipped spec.
 */
export interface TransportCapabilities {
  /** Chunks reach the app as they are produced, not all at once. */
  readonly streaming: boolean
  /** `api.ws()` works. */
  readonly websockets: boolean
  /** `api.recordHar()` works. */
  readonly harRecord: boolean
}

/** How a transport should answer one request. Delays have already been waited out. */
export type DispatchResult =
  | { readonly kind: 'reply'; readonly reply: MockReply }
  | { readonly kind: 'passthrough' }
  /** The request should fail at the network level. */
  | { readonly kind: 'error'; readonly fault: 'network-error' | 'abort' }

/**
 * What a transport is handed: the shared matcher. A transport only translates a
 * native request in and a `DispatchResult` out — precedence, logging and
 * unhandled-request policy all live behind this.
 */
export interface Dispatcher {
  dispatch(request: RawRequest): Promise<DispatchResult>
  /**
   * A WebSocket the app opened. Returns the mock's side of it, or `undefined`
   * when no `api.ws()` matches and the socket should connect for real.
   */
  connect(url: string): WsConnectionTarget | undefined
  /** Whether any `api.ws()` route is registered — a transport may skip patching otherwise. */
  hasWebSockets(): boolean
  /**
   * Called by a transport that observes real responses, for `recordHar()`.
   * A no-op unless a recording is running.
   */
  observe(entry: ObservedExchange): void
}

/** A request and the real response it got, as a recording transport reports it. */
export interface ObservedExchange {
  request: RawRequest
  status: number
  statusText: string
  headers: Record<string, string>
  body: string | Uint8Array | null
  startedAt: number
  durationMs: number
}

export interface InstalledTransport {
  /** Stops intercepting. Requests left hanging are released. */
  dispose(): Promise<void>
  /**
   * Starts handing real exchanges to `dispatcher.observe`. Only on transports
   * whose `capabilities.harRecord` is true.
   */
  startRecording?(): Promise<void>
  stopRecording?(): Promise<void>
  /** Called after each new `api.ws()` route, for transports that patch lazily. */
  webSocketsChanged?(): Promise<void>
}

export interface MockTransport {
  readonly capabilities: TransportCapabilities
  /**
   * The network an env drives: a Playwright `Page`, a WebdriverIO browser, the
   * window under jsdom. `mock(env)` hands back one `ApiMock` per key, so two envs
   * on the same page share their mocks.
   */
  key(env: EnvConfig): object
  install(env: EnvConfig, dispatcher: Dispatcher): Promise<InstalledTransport>
}

/**
 * Registers a driver's transport. Called by each driver for its side effect,
 * the same way it registers its query factory.
 */
export function registerMockTransport(driver: string, transport: MockTransport): void {
  globals().transports.set(driver, transport)
}

export function registeredMockTransports(): string[] {
  return [...globals().transports.keys()].sort()
}

export function transportFor(env: EnvConfig): MockTransport {
  const transport = globals().transports.get(env.driver)
  if (transport === undefined) {
    const known = registeredMockTransports()
    throw new Error(
      `harnessed: the "${env.driver}" driver has no mock transport registered. ` +
        (known.length === 0
          ? 'Import the driver package, which registers one, before calling mock(env).'
          : `Drivers with one: ${known.join(', ')}.`),
    )
  }
  return transport
}
