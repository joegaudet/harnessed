import { globals } from './globals'

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

const DEFAULTS: RuntimeConfig = {
  testIdAttribute: 'data-testid',
  defaultTimeout: 5_000,
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
 * The shape of `harnessed.config.ts`. The runtime reads `testIdAttribute` and
 * `defaultTimeout`; the ESLint plugin and the Claude skill generator read `layout`
 * and `testIdPattern`.
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
  Object.assign(globals().config, partial)
}

export function getConfig(): Readonly<RuntimeConfig> {
  return { ...DEFAULTS, ...(globals().config as Partial<RuntimeConfig>) }
}

/** Restores the defaults. Intended for tests of this library. */
export function resetConfig(): void {
  const store = globals().config
  for (const key of Object.keys(store)) delete store[key]
}
