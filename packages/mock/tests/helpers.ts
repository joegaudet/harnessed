import type { EnvConfig } from '@harnessed-ts/core'
import { registerMockTransport } from '../src'
import type { Dispatcher, DispatchResult, RawRequest } from '../src'

/**
 * A transport with no runner behind it: tests hand requests straight to the
 * dispatcher, so the shared matching, logging and policy can be checked on
 * their own. Each test gets its own key, so mocks never leak between them.
 */
export const TEST_DRIVER = 'mock-unit'
let dispatcher: Dispatcher | undefined
export const disposed: string[] = []

registerMockTransport(TEST_DRIVER, {
  capabilities: { streaming: true, websockets: true, harRecord: true },
  key: env => (env as TestEnv).network,
  async install(_env, given) {
    dispatcher = given
    return {
      async dispose() {
        disposed.push('dispose')
      },
    }
  },
})

export interface TestEnv extends EnvConfig {
  network: object
}

export function testEnv(): TestEnv {
  return { driver: TEST_DRIVER, network: {} }
}

export function send(request: Partial<RawRequest> & { url: string }): Promise<DispatchResult> {
  if (dispatcher === undefined) throw new Error('no mock installed')
  return dispatcher.dispatch({ method: 'GET', headers: {}, body: null, kind: 'fetch', ...request })
}

export function currentDispatcher(): Dispatcher {
  if (dispatcher === undefined) throw new Error('no mock installed')
  return dispatcher
}

export function replyOf(result: DispatchResult) {
  if (result.kind !== 'reply') throw new Error(`expected a reply, got ${JSON.stringify(result)}`)
  return result.reply
}

export function jsonOf(result: DispatchResult): unknown {
  const body = replyOf(result).body
  return JSON.parse(typeof body === 'string' ? body : new TextDecoder().decode(body!))
}
