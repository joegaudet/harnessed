/**
 * Runs in the page, for remote drivers whose network hook is unusable or
 * missing: it intercepts `fetch`, XHR and `WebSocket` with
 * `@mswjs/interceptors` and asks the test process how to answer, over a string
 * channel the transport supplies. Bundled into one script at build time (see
 * tsup.config.ts) and injected before the app's own scripts.
 */
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest/web'
import { answer, readRequest } from './fetch-glue'
import type { Controller } from './fetch-glue'
import { decodeResult, encodeRequest } from './wire'
import type { WireResult } from './wire'
import { wsShim } from './ws-bridge'
import type { RawRequest } from './types'

/** What the agent posts to the test process. */
export type AgentMessage =
  | { type: 'request'; id: number; request: ReturnType<typeof encodeRequest> }
  | { type: 'ws'; raw: string }

interface AgentWindow {
  __harnessedAgent?: { started: boolean }
  /** Settles a request: `(id, result)` as a JSON string. */
  __harnessedSettle?: (raw: string) => void
  __harnessedWsPost?: (raw: string) => void
}

function start(post: (raw: string) => void): void {
  const page: AgentWindow = window as Window & AgentWindow
  if (page.__harnessedAgent?.started === true) return
  page.__harnessedAgent = { started: true }

  const pending = new Map<number, (result: WireResult) => void>()
  let next = 0
  page.__harnessedSettle = raw => {
    const { id, result } = JSON.parse(raw) as { id: number; result: WireResult }
    pending.get(id)?.(result)
    pending.delete(id)
  }
  const ask = (request: RawRequest): Promise<WireResult> =>
    new Promise(resolve => {
      const id = ++next
      pending.set(id, resolve)
      const message: AgentMessage = { type: 'request', id, request: encodeRequest(request) }
      post(JSON.stringify(message))
    })

  const listen =
    (kind: RawRequest['kind']) =>
    async ({
      request,
      controller,
    }: {
      request: Request
      controller: Controller
    }): Promise<void> => {
      answer(controller, decodeResult(await ask(await readRequest(request, kind))))
    }
  const fetches = new FetchInterceptor()
  const xhrs = new XMLHttpRequestInterceptor()
  fetches.on('request', listen('fetch'))
  xhrs.on('request', listen('xhr'))
  fetches.apply()
  xhrs.apply()

  page.__harnessedWsPost = raw => {
    const message: AgentMessage = { type: 'ws', raw }
    post(JSON.stringify(message))
  }
  wsShim('__harnessedWsPost')
}

;(window as Window & { __harnessedStartAgent?: typeof start }).__harnessedStartAgent = start
