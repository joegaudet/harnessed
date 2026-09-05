export { ComponentHarness } from './component-harness'
export type { ComponentHarnessConstructor } from './component-harness'
export { configure, defineConfig, getConfig, resetConfig, timeoutFor } from './config'
export type { HarnessedConfig, LayoutConfig, RuntimeConfig, TestIdPatternConfig } from './config'
export {
  ByLabel,
  ByPlaceholder,
  ByRole,
  ByTestId,
  ByText,
  ChildHarness,
  Harness,
} from './decorators'
export type { ElementOptions } from './decorators'
export type { EnvConfig } from './env'
export { checkedFrom, emptySet, enabledFrom, indexOutOfRange, strictViolation } from './errors'
export type { HarnessHost } from './harness-host'
export { findHostMeta, requireHostMeta } from './host-meta'
export type { HarnessOptions } from './host-meta'
export { eachOf, filterOf, lastIndex, mapOf } from './list'
export type { Indexable } from './list'
export { harnessMatchers } from './matchers'
export type { Assertable, MatcherResult } from './matchers'
export { Query } from './query'
export type { WaitOptions, WaitState } from './query'
export { createQuery, registerDriver, registeredDrivers } from './registry'
export type { QueryFactory } from './registry'
export {
  describeScope,
  describeSelector,
  label,
  nth,
  placeholder,
  role,
  testId,
  text,
} from './selector'
export type { RoleOptions, Selector, SelectorType } from './selector'
export { testIdSync } from './test-id'
