import { registerMockTransport, resetMocks, wsShimScript, WsBridge } from '@harnessed-ts/mock'
import type { Dispatcher, InstalledTransport, RawRequest } from '@harnessed-ts/mock'
import { CYPRESS_DRIVER } from './driver-id'
import type { CypressEnv } from './env'

/**
 * How mocks reach Cypress. A harness runs inside one promise (see commands.ts),
 * where no `cy` command can be enqueued — so `mock(env)` cannot call
 * `cy.intercept` itself. Instead one catch-all intercept is registered before
 * every test, and hands each request to whichever mock is live. With no mock
 * live it lets the request through untouched.
 */
let live: Dispatcher | undefined

const POST_GLOBAL = '__harnessedWsPost'

function kindOf(resourceType: string): RawRequest['kind'] {
  if (resourceType === 'fetch') return 'fetch'
  if (resourceType === 'xhr') return 'xhr'
  if (resourceType === 'document') return 'document'
  return 'other'
}

function bodyOf(body: unknown): RawRequest['body'] {
  if (body === undefined || body === null || body === '') return null
  if (typeof body === 'string') return body
  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
  // Cypress hands a JSON body over already parsed.
  return JSON.stringify(body)
}

function interceptAll(): void {
  cy.intercept({ url: '**' }, async request => {
    const dispatcher = live
    if (dispatcher === undefined) return
    const raw: RawRequest = {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(
        Object.entries(request.headers).map(([name, value]) => [
          name,
          Array.isArray(value) ? value.join(', ') : value,
        ]),
      ),
      body: bodyOf(request.body),
      kind: kindOf(request.resourceType),
    }
    const result = await dispatcher.dispatch(raw)
    if (result.kind === 'passthrough') return
    if (result.kind === 'error') {
      request.destroy()
      return
    }
    const { reply } = result
    request.reply({
      statusCode: reply.status,
      headers: reply.headers,
      body:
        reply.body === null
          ? ''
          : typeof reply.body === 'string'
            ? reply.body
            : Cypress.Buffer.from(reply.body),
    })
  }).as('harnessed-mock')
}

/** Puts the WebSocket shim into each new AUT document while a mock has sockets. */
function shimSockets(win: Window): void {
  const dispatcher = live
  if (dispatcher === undefined || !dispatcher.hasWebSockets()) return
  // The AUT shares the spec's origin, so the bridge talks to it directly.
  const page = win as unknown as Record<string, unknown> & { eval(code: string): unknown }
  const bridge = new WsBridge(dispatcher, async raw => {
    ;(page['__harnessedWs'] as (message: string) => void)(raw)
  })
  page[POST_GLOBAL] = (raw: string) => bridge.receive(raw)
  page.eval(wsShimScript(POST_GLOBAL))
}

let hooked = false

/**
 * Registers the catch-all intercept before each test, and ends every mock
 * after it, reporting anything left unverified as that test's failure.
 * Importing `@harnessed-ts/cypress/mock` calls it; it runs once however many
 * times it is imported.
 */
export function registerMockHooks(): void {
  if (hooked) return
  hooked = true
  beforeEach(() => {
    interceptAll()
  })
  // Mocha waits for the returned promise; no cy command is enqueued here.
  afterEach(() => resetMocks())
  Cypress.on('window:before:load', shimSockets)
}

registerMockTransport(CYPRESS_DRIVER, {
  // Buffered: `req.reply` sends the body in one piece.
  capabilities: { streaming: false, websockets: true, harRecord: false },
  // The AUT window is one object for the whole run; each test's mock is ended
  // after it, so the next test's `mock(env)` starts a fresh one.
  key: env => (env as CypressEnv).window,
  async install(env, dispatcher): Promise<InstalledTransport> {
    if (!hooked) {
      throw new Error(
        "harnessed: mocking under Cypress needs its hooks. Import '@harnessed-ts/cypress/mock' from your support file.",
      )
    }
    live = dispatcher
    return {
      async dispose() {
        if (live === dispatcher) live = undefined
      },
      // Component tests mount without navigating, so no `window:before:load`
      // follows; the document already there gets the shim now.
      async webSocketsChanged() {
        shimSockets((env as CypressEnv).window)
      },
    }
  },
})
