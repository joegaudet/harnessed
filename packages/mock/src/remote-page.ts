/**
 * The test-process side of the page agent, for remote drivers: the agent's
 * script to inject, and the bridge that answers what it asks.
 *
 * ```ts
 * // In the page, before any app script, with `post` sending strings to Node:
 * `${PAGE_AGENT}; window.__harnessedStartAgent(post)`
 * ```
 */
// Replaced at build time by the page agent bundled into one string; see tsup.config.ts.
import agent from './page-agent?bundle'
import type { AgentMessage } from './page-agent'
import type { Dispatcher } from './transport'
import { decodeRequest, encodeResult } from './wire'
import { WsBridge } from './ws-bridge'

/** The agent as a script: defines `window.__harnessedStartAgent(post)`. */
export const PAGE_AGENT: string = agent

/** How the test process reaches the page: calls `window[fn](raw)` there. */
export type PageCall = (fn: '__harnessedSettle' | '__harnessedWs', raw: string) => Promise<void>

export class PageAgentBridge {
  readonly #dispatcher: Dispatcher
  readonly #call: PageCall
  readonly #sockets: WsBridge

  constructor(dispatcher: Dispatcher, call: PageCall) {
    this.#dispatcher = dispatcher
    this.#call = call
    this.#sockets = new WsBridge(dispatcher, raw => call('__harnessedWs', raw))
  }

  /** Feed every string the agent posts through here. */
  receive(raw: string): void {
    const message = JSON.parse(raw) as AgentMessage
    if (message.type === 'ws') {
      this.#sockets.receive(message.raw)
      return
    }
    void this.#dispatcher
      .dispatch(decodeRequest(message.request))
      .then(result =>
        this.#call(
          '__harnessedSettle',
          JSON.stringify({ id: message.id, result: encodeResult(result) }),
        ),
      )
      .catch(() => {
        // The page navigated away while the request was in flight.
      })
  }
}
