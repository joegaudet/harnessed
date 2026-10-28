import { registerMockTransport } from '@harnessed-ts/mock'
import type { Dispatcher, InstalledTransport } from '@harnessed-ts/mock'
import { PAGE_AGENT, PageAgentBridge } from '@harnessed-ts/mock/remote-page'
import { WEBDRIVERIO_DRIVER } from './driver-id'
import type { WebdriverioEnv } from './env'

interface ScriptMessage {
  channel: string
  data: { type: string; value?: unknown }
  source: { context?: string }
}

/** The BiDi commands used here, as WebdriverIO names them. */
interface BidiBrowser {
  isBidi: boolean
  sessionSubscribe(params: { events: string[] }): Promise<unknown>
  scriptAddPreloadScript(params: Record<string, unknown>): Promise<{ script: string }>
  scriptRemovePreloadScript(params: { script: string }): Promise<unknown>
  scriptCallFunction(params: Record<string, unknown>): Promise<unknown>
  on(event: string, listener: (params: never) => void): unknown
  off(event: string, listener: (params: never) => void): unknown
}

const CHANNEL = 'harnessed-mock'

async function install(browser: BidiBrowser, dispatcher: Dispatcher): Promise<InstalledTransport> {
  if (!browser.isBidi) {
    throw new Error(
      'harnessed: mocking under WebdriverIO needs WebDriver BiDi, which WebDriver Classic has no equivalent of. ' +
        'BiDi is WebdriverIO’s default; remove `wdio:enforceWebDriverClassic` from the capabilities that mock.',
    )
  }

  /**
   * Requests are intercepted in the page, not paused in the network: a request
   * held at a BiDi intercept stalls the navigation it belongs to, and a Classic
   * command waiting on that navigation then deadlocks the session. The agent
   * asks over a preload script's channel and is answered with script calls.
   */
  const bridges = new Map<string, PageAgentBridge>()
  const bridgeFor = (context: string): PageAgentBridge => {
    let bridge = bridges.get(context)
    if (bridge === undefined) {
      bridge = new PageAgentBridge(dispatcher, async (fn, raw) => {
        await browser.scriptCallFunction({
          functionDeclaration: '(fn, raw) => window[fn](raw)',
          arguments: [
            { type: 'string', value: fn },
            { type: 'string', value: raw },
          ],
          target: { context },
          awaitPromise: false,
        })
      })
      bridges.set(context, bridge)
    }
    return bridge
  }

  const onMessage = (message: ScriptMessage): void => {
    if (message.channel !== CHANNEL || typeof message.data.value !== 'string') return
    if (message.source.context === undefined) return
    bridgeFor(message.source.context).receive(message.data.value)
  }
  browser.on('script.message', onMessage as (params: never) => void)
  await browser.sessionSubscribe({ events: ['script.message'] })
  // A preload script runs before any of the page's own, in every new document,
  // so a request fired while a page loads is already intercepted.
  const { script } = await browser.scriptAddPreloadScript({
    functionDeclaration: `(channel) => { ${PAGE_AGENT}; window.__harnessedStartAgent(raw => channel(raw)) }`,
    arguments: [{ type: 'channel', value: { channel: CHANNEL } }],
  })

  return {
    async dispose() {
      browser.off('script.message', onMessage as (params: never) => void)
      await browser.scriptRemovePreloadScript({ script }).catch(() => {
        // The session ended first.
      })
    },
  }
}

registerMockTransport(WEBDRIVERIO_DRIVER, {
  // In-page, so a streamed body is streamed. HAR recording needs a network-level
  // view, which this transport deliberately does not take.
  capabilities: { streaming: true, websockets: true, harRecord: false },
  key: env => (env as WebdriverioEnv).browser,
  install: (env, dispatcher) =>
    install((env as WebdriverioEnv).browser as unknown as BidiBrowser, dispatcher),
})
