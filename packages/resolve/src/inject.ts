import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Leaf modules only: this entry runs in the test process, where the resolver
// and Testing Library have no business loading.
export { PAGE_API_GLOBAL } from './global-name'
export { encodeSelector } from './wire'
export type { WireSelector } from './wire'
export type { PageApi, PageApiOptions } from './page-api'

declare const __filename: string | undefined

/**
 * Absolute path to the injectable build, for drivers that inject by path
 * (TestCafe's `clientScripts`, Puppeteer's `addScriptTag`).
 */
export function injectPath(): string {
  // A sibling in dist/. The CJS build has __filename; the ESM build has
  // import.meta.url and no __filename, so each takes its own branch.
  if (typeof __filename === 'string') return join(dirname(__filename), 'inject.global.js')
  return fileURLToPath(new URL('./inject.global.js', import.meta.url))
}

let cached: string | undefined

/**
 * The injectable build's source, for drivers that inject by evaluating a string
 * (WebdriverIO's `execute`, Puppeteer's `evaluate`). Read once per process.
 */
export function injectSource(): string {
  if (cached === undefined) cached = readFileSync(injectPath(), 'utf8')
  return cached
}
