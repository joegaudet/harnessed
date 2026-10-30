import { registerMockTransport, WsBridge, wsShimScript } from '@harnessed-ts/mock'
import type { Dispatcher, InstalledTransport, RawRequest } from '@harnessed-ts/mock'
import type { HTTPRequest, HTTPResponse, Page } from 'puppeteer'
import { PUPPETEER_DRIVER } from './driver-id'
import type { PuppeteerEnv } from './env'

/** Above Puppeteer's default, so a mocked answer wins over another handler's `continue()`. */
const MOCK_PRIORITY = 1
/** At the default, so a handler registered by the test can still answer what we pass on. */
const PASS_PRIORITY = 0
const POST_GLOBAL = '__harnessedWsPost'

function kindOf(resourceType: string): RawRequest['kind'] {
  if (resourceType === 'fetch') return 'fetch'
  if (resourceType === 'xhr') return 'xhr'
  if (resourceType === 'document') return 'document'
  return 'other'
}

async function quietly(work: () => Promise<unknown>): Promise<void> {
  try {
    await work()
  } catch (error) {
    // The page closed, or another handler resolved the request first.
    if (!/closed|Target|already handled|Session/i.test(String(error))) throw error
  }
}

async function install(page: Page, dispatcher: Dispatcher): Promise<InstalledTransport> {
  let disposed = false
  let recording = false
  const answered = new WeakSet<HTTPRequest>()

  const onRequest = async (request: HTTPRequest): Promise<void> => {
    if (disposed || request.isInterceptResolutionHandled()) return
    const raw: RawRequest = {
      method: request.method(),
      url: request.url(),
      headers: request.headers(),
      body: request.hasPostData() ? ((await request.fetchPostData()) ?? null) : null,
      kind: kindOf(request.resourceType()),
    }
    const result = await dispatcher.dispatch(raw)
    await quietly(async () => {
      if (result.kind === 'reply') {
        answered.add(request)
        const { reply } = result
        await request.respond(
          {
            status: reply.status,
            headers: reply.headers,
            ...(reply.body === null ? {} : { body: Buffer.from(reply.body) }),
          },
          MOCK_PRIORITY,
        )
      } else if (result.kind === 'error') {
        answered.add(request)
        await request.abort(result.fault === 'abort' ? 'aborted' : 'failed', MOCK_PRIORITY)
      } else {
        await request.continue(request.continueRequestOverrides(), PASS_PRIORITY)
      }
    })
  }

  // HAR recording reads real responses as they arrive; Puppeteer cannot hold one
  // back, so recording observes rather than intercepts.
  const onResponse = async (response: HTTPResponse): Promise<void> => {
    const request = response.request()
    if (!recording || answered.has(request)) return
    let body: Uint8Array | null = null
    try {
      body = new Uint8Array(await response.buffer())
    } catch {
      // Redirects and some cached responses have no body to read.
    }
    dispatcher.observe({
      request: {
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        body: request.postData() ?? null,
      },
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      body,
      startedAt: Date.now(),
      durationMs: 0,
    })
  }

  await page.setRequestInterception(true)
  page.on('request', onRequest)
  page.on('response', onResponse)

  let sockets = false
  const enableSockets = async (): Promise<void> => {
    if (sockets || !dispatcher.hasWebSockets()) return
    sockets = true
    const bridge = new WsBridge(dispatcher, raw =>
      page.evaluate((message: string) => {
        ;(Reflect.get(window, '__harnessedWs') as (raw: string) => void)(message)
      }, raw),
    )
    await page.exposeFunction(POST_GLOBAL, (raw: string) => bridge.receive(raw))
    const script = wsShimScript(POST_GLOBAL)
    await page.evaluateOnNewDocument(script)
    // And into the document already loaded, if there is one.
    await quietly(() => page.evaluate(script))
  }
  await enableSockets()

  return {
    async dispose() {
      disposed = true
      page.off('request', onRequest)
      page.off('response', onResponse)
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

registerMockTransport(PUPPETEER_DRIVER, {
  // Buffered: `request.respond` sends the body in one piece.
  capabilities: { streaming: false, websockets: true, harRecord: true },
  key: env => (env as PuppeteerEnv).page,
  install: (env, dispatcher) => install((env as PuppeteerEnv).page, dispatcher),
})
