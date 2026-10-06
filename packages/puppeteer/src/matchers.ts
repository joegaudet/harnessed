import { harnessMatchers } from '@harnessed-ts/core'
import type { Assertable } from '@harnessed-ts/core'
import { expect } from 'vitest'

// Puppeteer has no runner of its own, so this registers with Vitest's `expect`:
// `import '@harnessed-ts/puppeteer/matchers'` from a setup file is all a suite
// needs. Under Jest, call `expect.extend(harnessMatchers)` from
// `@harnessed-ts/core` in a setup file instead.
expect.extend(harnessMatchers)

declare module 'vitest' {
  // The parameter list must match vitest's own declaration exactly. `T` is the
  // subject, and gating on it means calling these on something that is not a
  // target or a harness is a type error rather than a runtime surprise.
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toBeSelected(): T extends Assertable ? R : never
    toBeAbsent(): T extends Assertable ? R : never
    toReadAs(expected: string | RegExp): T extends Assertable ? R : never
  }
}
