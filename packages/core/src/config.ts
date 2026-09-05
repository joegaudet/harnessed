import { DEFAULT_RUNTIME_CONFIG, globals } from './globals'

/** Settings the drivers read at query time. */
export interface RuntimeConfig {
  /**
   * The attribute `testId` selectors match. Both Testing Library and Playwright
   * allow renaming it; a harness should not have to care which.
   */
  testIdAttribute: string
  /** Default milliseconds a driver waits for a target before giving up. */
  defaultTimeout: number
}

/** Where harnesses live and how their test ids are named. Read by tooling, not at runtime. */
export interface LayoutConfig {
  /** Directory holding reusable widgets. */
  components?: string
  /** Directory holding screens or pages. */
  screens?: string
  /** Directory harnesses are written to. */
  harnesses?: string
  /**
   * Where widget harnesses go, if not directly under `harnesses`. Repos that
   * mirror their source tree usually want a subdirectory — an agent told the
   * wrong path puts the file somewhere the suite will not find it.
   */
  widgetHarnesses?: string
  /** Where screen harnesses go, if not directly under `harnesses`. */
  screenHarnesses?: string
}

export interface TestIdPatternConfig {
  /** Pattern for a widget's root test id, e.g. `ui-<kebab>`. */
  widget?: string
  /** Pattern for a screen's root test id, e.g. `screen-<kebab>`. */
  screen?: string
}

/**
 * The shape of `harnessed.config.ts` — one place for a repo to declare these,
 * so the runtime, the linter, and the docs generator describe the same layout.
 *
 * There is no loader yet: nothing reads this file off disk. Today `configure()`
 * takes the runtime half by hand, `@harnessed/eslint-plugin` takes `layout` as
 * rule options, and `@harnessed/claude` writes the file from what it detects.
 * Wiring a real loader through all three is tracked as follow-up work.
 */
export interface HarnessedConfig extends Partial<RuntimeConfig> {
  layout?: LayoutConfig
  testIdPattern?: TestIdPatternConfig
}

/** Identity function that gives `harnessed.config.ts` its types. */
export function defineConfig(config: HarnessedConfig): HarnessedConfig {
  return config
}

/** Applies runtime settings. Call once, before any harness is constructed. */
export function configure(partial: Partial<RuntimeConfig>): void {
  const slot = globals()
  Object.assign(slot.overrides, partial)
  slot.merged = Object.freeze({ ...DEFAULT_RUNTIME_CONFIG, ...slot.overrides })
}

/**
 * The settings drivers read.
 *
 * Returns the stored merged object rather than building one: this sits on the
 * hot path of every query, and a spread per call is a garbage object per query.
 */
export function getConfig(): Readonly<RuntimeConfig> {
  return globals().merged
}

/** Milliseconds to wait, honouring an explicit override. */
export function timeoutFor(explicit?: number): number {
  return explicit ?? getConfig().defaultTimeout
}

/** Restores the defaults. Intended for tests of this library. */
export function resetConfig(): void {
  const slot = globals()
  slot.overrides = {}
  slot.merged = DEFAULT_RUNTIME_CONFIG
}
