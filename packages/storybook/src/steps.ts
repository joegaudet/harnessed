import { ScopedHarness } from '@harnessed-ts/core'

/** Storybook's `context.step`, narrowed to what the proxy needs. */
export type StepRunner = (label: string, play: () => Promise<void>) => Promise<unknown> | unknown

const SECRET = /pass|secret|token|credential/i
// Short names match whole words only, so `author`, `keyboard` and `typing` stay visible.
const SECRET_WORD = /^(key|pin|otp|auth)$/i
// camelCase, PascalCase acronyms (`APIKey`) and snake/kebab-case word breaks.
const WORD_BREAK = /[^a-zA-Z0-9]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/
const REDACTED = '•••'
const MAX_ARG = 40

const AsyncFunction = (async () => {}).constructor

const proxies = new WeakMap<object, unknown>()

/**
 * The harness, with every public async method run inside `step()` — so the
 * Interactions panel reads `LoginFormHarness.signInAs("ada@…", "•••")` with the
 * raw clicks and keystrokes nested under it, rather than a flat list of events.
 *
 * Methods run against the real instance, not the proxy: a harness calling its
 * own methods does not log a step per call, and decorated `accessor` fields
 * (backed by private slots a proxy cannot reach) keep working. Sync methods stay
 * sync; a harness they return — `nth()`, a child — comes back wrapped too.
 *
 * shortcut: async is detected by `AsyncFunction`, so a plain method that returns
 * a promise, or one down-levelled to a generator, logs no step. Upgrade if a
 * harness or a build ever needs that.
 */
export function withSteps<T extends ScopedHarness>(harness: T, step: StepRunner): T {
  const cached = proxies.get(harness)
  if (cached !== undefined) return cached as T
  const className = harness.constructor.name

  const wrap = (value: unknown): unknown => {
    if (value instanceof ScopedHarness) return withSteps(value, step)
    if (Array.isArray(value) && value.some(item => item instanceof ScopedHarness)) {
      return value.map(wrap)
    }
    return value
  }

  const proxy = new Proxy(harness, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return wrap(value)
      if (typeof prop !== 'string' || prop === 'constructor' || prop.startsWith('_')) {
        return (value as (...args: unknown[]) => unknown).bind(target)
      }
      const method = value as (...args: unknown[]) => unknown
      if (method instanceof AsyncFunction) {
        return async (...args: unknown[]) => {
          let result: unknown
          await step(stepLabel(className, method, args, prop), async () => {
            result = await method.apply(target, args)
          })
          return wrap(result)
        }
      }
      return (...args: unknown[]) => wrap(method.apply(target, args))
    },
    // An accessor's setter writes a private slot only the real instance has.
    set: (target, prop, value) => Reflect.set(target, prop, value, target),
  })
  proxies.set(harness, proxy)
  return proxy
}

/**
 * `Harness.method(args…)`, each argument shortened, and any argument whose
 * parameter name — or object key — looks like a secret replaced with `•••`.
 *
 * Names are read from the source, so a minified `storybook build` shows mangled
 * class names and masks only object keys, not positional arguments.
 */
export function stepLabel(
  className: string,
  method: (...args: never[]) => unknown,
  args: readonly unknown[],
  name: string = method.name,
): string {
  const params = parameterNames(method)
  const shown = args.map((arg, index) =>
    isSecret(params[index] ?? '') ? JSON.stringify(REDACTED) : formatArg(arg),
  )
  return `${className}.${name}(${shown.join(', ')})`
}

function isSecret(name: string): boolean {
  return SECRET.test(name) || name.split(WORD_BREAK).some(word => SECRET_WORD.test(word))
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'function') return 'ƒ'
  if (arg instanceof ScopedHarness) return arg.constructor.name
  if (typeof arg === 'string') {
    return JSON.stringify(arg.length > MAX_ARG ? `${arg.slice(0, MAX_ARG)}…` : arg)
  }
  const json =
    JSON.stringify(arg, (key, value: unknown) => (isSecret(key) ? REDACTED : value)) ?? String(arg)
  return json.length > MAX_ARG ? `${json.slice(0, MAX_ARG)}…` : json
}

/** Plain parameter names from the source; none when they are destructured. */
function parameterNames(method: (...args: never[]) => unknown): string[] {
  const list = /\(([^)]*)\)/.exec(Function.prototype.toString.call(method))?.[1] ?? ''
  if (/[{[]/.test(list)) return []
  return list.split(',').map(param => param.replace(/[=:].*$/s, '').trim())
}
