/// <reference types="bun" />
import { harnessMatchers } from '@harnessed-ts/core'
import type { Assertable } from '@harnessed-ts/core'
import { expect } from 'bun:test'

// `import '@harnessed-ts/dom/matchers/bun'` from a `bunfig.toml` preload
// registers all three with bun:test's `expect`. A separate entry from
// `/matchers`, which imports Vitest and cannot load under Bun.
// bun:test types a matcher's subject as `unknown`; these narrow it to a target
// or a harness, and the `Matchers` declaration below enforces that at call sites.
expect.extend(harnessMatchers as unknown as Parameters<typeof expect.extend>[0])

declare module 'bun:test' {
  // The type parameter list must match bun:test's own declaration. `T` is the
  // subject, and gating on it means calling these on something that is not a
  // target or a harness is a type error rather than a runtime surprise.
  interface Matchers<T = unknown> {
    toBeSelected(): T extends Assertable ? Promise<void> : never
    toBeAbsent(): T extends Assertable ? Promise<void> : never
    toReadAs(expected: string | RegExp): T extends Assertable ? Promise<void> : never
  }
}
