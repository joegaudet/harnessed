import { registerMockTransport } from '@harnessed-ts/mock'
import type { Dispatcher, InstalledTransport, RawRequest } from '@harnessed-ts/mock'
import { RequestHook, RequestMock } from 'testcafe'
import { TESTCAFE_DRIVER } from './driver-id'
import type { TestCafeEnv } from './env'

/**
 * The parts of hammerhead's request event this transport reads and writes.
 * `_requestInfo` is what TestCafe's own RequestLogger reads; there is no
 * public equivalent.
 */
interface RequestEvent {
  _requestInfo: {
    url: string
    method: string
    headers: Record<string, string>
    body?: Buffer
    isAjax: boolean
  }
  requestOptions: {
    hostname: string
    host: string
    port: number | string
    protocol: string
    path: string
  }
  setMock(mock: unknown): Promise<void>
}

interface ResponseMockClass {
  from(init: {
    body: Buffer | string
    statusCode: number
    headers: Record<string, string>
  }): unknown
}

/**
 * hammerhead's ResponseMock, which TestCafe does not export. A RequestMock
 * builds one per rule, so one built here and read back gives the class without
 * depending on hammerhead directly.
 */
function responseMockClass(): ResponseMockClass {
  const probe = RequestMock()
    .onRequestTo(() => false)
    .respond('') as unknown as { mocks: Map<string, object> }
  return probe.mocks.values().next().value!.constructor as unknown as ResponseMockClass
}

/** A port nothing listens on: sending a request there is how a network failure is staged. */
const UNREACHABLE = { hostname: '127.0.0.1', port: 9 }

class MockHook extends RequestHook {
  readonly #dispatcher: Dispatcher
  readonly #ResponseMock = responseMockClass()
  disposed = false

  constructor(dispatcher: Dispatcher) {
    super(undefined, {})
    this.#dispatcher = dispatcher
  }

  override async onRequest(event: object): Promise<void> {
    if (this.disposed) return
    const request = (event as RequestEvent)._requestInfo
    const raw: RawRequest = {
      method: request.method.toUpperCase(),
      url: request.url,
      headers: request.headers,
      body:
        request.body !== undefined && request.body.length > 0 ? new Uint8Array(request.body) : null,
      kind: request.isAjax ? 'fetch' : 'other',
    }
    const result = await this.#dispatcher.dispatch(raw)
    if (result.kind === 'passthrough') return
    if (result.kind === 'error') {
      // TestCafe can mock a response but not fail one, so the request is sent
      // where nothing answers — the browser sees the same network error.
      const options = (event as RequestEvent).requestOptions
      options.hostname = UNREACHABLE.hostname
      options.host = `${UNREACHABLE.hostname}:${UNREACHABLE.port}`
      options.port = UNREACHABLE.port
      options.protocol = 'http:'
      return
    }
    const { reply } = result
    await (event as RequestEvent).setMock(
      this.#ResponseMock.from({
        body: reply.body === null ? '' : Buffer.from(reply.body),
        statusCode: reply.status,
        headers: reply.headers,
      }),
    )
  }

  override async onResponse(): Promise<void> {}
}

async function install(t: TestController, dispatcher: Dispatcher): Promise<InstalledTransport> {
  const hook = new MockHook(dispatcher)
  await t.addRequestHooks(hook)
  return {
    async dispose() {
      hook.disposed = true
      await t.removeRequestHooks(hook).catch(() => {
        // The test is over and took its hooks with it.
      })
    },
  }
}

registerMockTransport(TESTCAFE_DRIVER, {
  // Buffered, and no sockets: TestCafe's proxy offers neither a streamed
  // response nor a hook on WebSockets.
  capabilities: { streaming: false, websockets: false, harRecord: false },
  // Hooks are attached per test, through the test's own controller.
  key: env => (env as TestCafeEnv).t,
  install: (env, dispatcher) => install((env as TestCafeEnv).t, dispatcher),
})
