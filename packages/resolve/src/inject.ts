import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export { PAGE_API_GLOBAL } from './page-api'
export { encodeSelector } from './wire'
export type { WireSelector } from './wire'
export type { PageApi, PageApiOptions } from './page-api'

/**
 * Absolute path to the injectable build, for drivers that inject by path
 * (TestCafe's `clientScripts`, Puppeteer's `addScriptTag`).
 */
export function injectPath(): string {
  // A sibling in dist/, so it resolves the same way from the ESM and CJS builds.
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
