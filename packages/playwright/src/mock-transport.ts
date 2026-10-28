import { registerMockTransport } from '@harnessed-ts/mock'
import type { Dispatcher, InstalledTransport, MockReply, RawRequest } from '@harnessed-ts/mock'
import type { Page, Route, WebSocketRoute } from '@playwright/test'
import { PLAYWRIGHT_DRIVER } from './driver-id'
import type { PlaywrightEnv } from './env'

function kindOf(resourceType: string): RawRequest['kind'] {
  if (resourceType === 'fetch') return 'fetch'
  if (resourceType === 'xhr') return 'xhr'
  if (resourceType === 'document') return 'document'
  return 'other'
}

function headersOf(reply: MockReply): Record<string, string> {
  // Playwright takes one value per header; repeated Set-Cookie is newline-joined,
  // which is what Playwright splits on too.
  return { ...reply.headers }
}

/** A page closed under a pending route makes every route call throw; nothing is left to answer. */
async function quietly(work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch (error) {
    if (!/closed|disposed|already handled/i.test(String(error))) throw error
  }
}

async function install(page: Page, dispatcher: Dispatcher): Promise<InstalledTransport> {
  let recording = false
  let disposed = false

  const handler = async (route: Route): Promise<void> => {
    const request = route.request()
    const raw: RawRequest = {
      method: request.method(),
      url: request.url(),
      headers: await request.allHeaders(),
      body: request.postDataBuffer(),
      kind: kindOf(request.resourceType()),
    }
    const result = await dispatcher.dispatch(raw)
    await quietly(async () => {
      if (result.kind === 'error') {
        await route.abort(result.fault === 'abort' ? 'aborted' : 'failed')
      } else if (result.kind === 'reply') {
        const { reply } = result
        await route.fulfill({
          status: reply.status,
          headers: headersOf(reply),
          ...(reply.body === null ? {} : { body: Buffer.from(reply.body) }),
        })
      } else if (recording) {
        const startedAt = Date.now()
        const response = await route.fetch()
        const body = await response.body()
        dispatcher.observe({
          request: raw,
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          body: new Uint8Array(body),
          startedAt,
          durationMs: Date.now() - startedAt,
        })
        await route.fulfill({ response, body })
      } else {
        // Not ours: let any route the test registered itself have it.
        await route.fallback()
      }
    })
  }

  let sockets = false
  const enableSockets = async (): Promise<void> => {
    if (sockets || !dispatcher.hasWebSockets()) return
    if (typeof page.routeWebSocket !== 'function') {
      throw new Error(
        'harnessed: mocking WebSockets under Playwright needs @playwright/test 1.48 or later.',
      )
    }
    sockets = true
    await page.routeWebSocket(/.*/, (socket: WebSocketRoute) => {
      const target = disposed ? undefined : dispatcher.connect(socket.url())
      if (target === undefined) {
        socket.connectToServer()
        return
      }
      socket.onMessage(message =>
        target.message(typeof message === 'string' ? message : new Uint8Array(message)),
      )
      socket.onClose((code, reason) => target.closed(code ?? 1005, reason ?? ''))
      target.open({
        send: data => socket.send(typeof data === 'string' ? data : Buffer.from(data)),
        close: (code, reason) =>
          void socket.close({
            ...(code === undefined ? {} : { code }),
            ...(reason === undefined ? {} : { reason }),
          }),
      })
    })
  }

  await page.route('**/*', handler)
  await enableSockets()

  return {
    async dispose() {
      disposed = true
      await quietly(() => page.unroute('**/*', handler))
    },
    async startRecording() {
      recording = true
    },
    async stopRecording() {
      recording = false
    },
    webSocketsChanged: enableSockets,
  }
}

registerMockTransport(PLAYWRIGHT_DRIVER, {
  // Buffered: `route.fulfill` sends the body in one piece.
  capabilities: { streaming: false, websockets: true, harRecord: true },
  key: env => (env as PlaywrightEnv).page,
  install: (env, dispatcher) => install((env as PlaywrightEnv).page, dispatcher),
})
