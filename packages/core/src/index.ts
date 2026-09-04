export { ComponentHarness } from './component-harness'
export type { ComponentHarnessConstructor } from './component-harness'
export { configure, defineConfig, getConfig, resetConfig } from './config'
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
export type { HarnessHost } from './harness-host'
export { harnessMatchers } from './matchers'
export type { Assertable, MatcherResult } from './matchers'
export { findHostMeta, requireHostMeta } from './host-meta'
export type { HarnessOptions } from './host-meta'
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
  SELECTOR_PRIORITY,
  testId,
  text,
} from './selector'
export type { RoleOptions, Selector, SelectorType } from './selector'
