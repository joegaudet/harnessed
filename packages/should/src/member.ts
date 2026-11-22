import { markWrapped } from '@harnessed-ts/core'
import { valueChain } from './chain'
import { show } from './format'

/** Members that build a harness or are its `should`, rather than read it: left as they are. */
const PLUMBING = new Set(['constructor', 'should', 'elementBy', 'childHarness'])

type Method = (...args: unknown[]) => unknown

/**
 * A method's stand-in: bound to the harness, `should` on itself reads the
 * method with no arguments, and a call returns what the method returns, with a
 * `should` on it when that is a promise. The prototype is the method's own, so
 * `instanceof AsyncFunction` (storybook's step logging) still answers truly.
 */
function memberOf(harness: object, name: string, method: Method): Method {
  const owner = harness.constructor.name
  const label = (args: unknown[]): string => `${owner}.${name}(${args.map(show).join(', ')})`
  const attach = (reading: Promise<unknown>, args: unknown[]): void => {
    // The first attempt asserts on this call; a retry calls the method again.
    let pending: Promise<unknown> | undefined = reading
    const read = (): Promise<unknown> => {
      const current = pending ?? Promise.resolve(method.apply(harness, args))
      pending = undefined
      return current
    }
    Object.defineProperty(reading, 'should', {
      configurable: true,
      get: () => valueChain(label(args), `${label(args)}.should`, read),
    })
  }
  const member = (...args: unknown[]): unknown => {
    const result = method.apply(harness, args)
    if (result instanceof Promise) attach(result, args)
    return result
  }
  Object.setPrototypeOf(member, Object.getPrototypeOf(method))
  markWrapped(member, method, attach)
  Object.defineProperty(member, 'name', { value: name })
  Object.defineProperty(member, 'should', {
    configurable: true,
    get: () =>
      valueChain(label([]), `${owner}.${name}.should`, async () => method.apply(harness, [])),
  })
  return member as Method
}

/**
 * What `registerHarnessWrapper` is handed. The proxy is what the harness's
 * constructor returns, so it is `this` everywhere, subclass `#private` fields
 * included: getters and methods are called on it, never on the target.
 */
export function wrapMembers<T extends object>(harness: T): T {
  const members = new Map<string, { method: Method; member: Method }>()
  const proxy: T = new Proxy(harness, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function' || typeof prop !== 'string') return value
      if (PLUMBING.has(prop) || prop.startsWith('_')) return value
      const cached = members.get(prop)
      if (cached?.method === value) return cached.member
      const member = memberOf(proxy, prop, value as Method)
      members.set(prop, { method: value as Method, member })
      return member
    },
  })
  return proxy
}
