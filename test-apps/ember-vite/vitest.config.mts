import { babel } from '@rollup/plugin-babel'
import { playwright } from '@vitest/browser-playwright'
import { classicEmberSupport, ember, extensions } from '@embroider/vite'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const environment = require('./config/environment.js') as (env: string) => Record<string, unknown>

/**
 * Classic support (compat modules, .hbs templates) without its index.html
 * transforms: Vitest serves its own test page, which has no `content-for`
 * placeholders for them to fill.
 */
const HTML_ONLY = new Set(['embroider-content-for', 'embroider-scripts'])
const classicPlugins = [classicEmberSupport()].flat(3) as Array<{ name?: string } | null>
const removed = classicPlugins.filter(plugin => HTML_ONLY.has(plugin?.name ?? ''))
// Plugin names are Embroider internals. Fail loudly if they change, rather
// than letting a transform that breaks Vitest's page back in silently.
if (removed.length !== HTML_ONLY.size) {
  throw new Error(
    `expected Embroider's ${[...HTML_ONLY].join(' and ')} plugins, found ${removed.length}: update vitest.config.mts`,
  )
}
const classicWithoutHtml = classicPlugins.filter(plugin => !HTML_ONLY.has(plugin?.name ?? ''))

/**
 * The same app under Vitest browser mode: Embroider, and Babel with
 * @harnessed-ts/core/babel (babel.config.mjs). Tests live in `vitest/`, apart
 * from the QUnit tests the Testem run globs under `tests/`.
 */
export default defineConfig({
  // The app reads its config from a <meta> tag the Embroider HTML transform
  // writes; vitest/setup.ts writes it from this instead.
  define: { __APP_CONFIG__: JSON.stringify(environment('test')) },
  plugins: [
    ...(classicWithoutHtml as PluginOption[]),
    ember(),
    babel({ babelHelpers: 'runtime', extensions }),
  ],
  test: {
    include: ['vitest/**/*.test.{ts,gts}'],
    setupFiles: ['vitest/setup.ts'],
    // ember-vitest's test contexts are module-level state: no test.concurrent.
    maxConcurrency: 1,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    // A port of its own, so this runner can work beside the others.
    api: { port: 5186, strictPort: true },
  },
})
