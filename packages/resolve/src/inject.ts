import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
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

let uploads: string | undefined
let written = 0

/**
 * Writes files to disk for a driver whose browser only takes file paths
 * (Puppeteer's `uploadFile`, WebDriver's file input, TestCafe's
 * `setFilesToUpload`), and returns the paths in order.
 *
 * Each file gets a directory of its own, so its name survives as the path's
 * last segment even when two files share one. The browser reads the file when
 * the page does — after the upload resolves — so nothing is deleted until the
 * process exits. What travels is the name and the bytes: the browser infers
 * `type` from the extension, and `lastModified` is the time of writing.
 */
export async function filesOnDisk(files: readonly File[]): Promise<string[]> {
  if (uploads === undefined) {
    const root = mkdtempSync(join(tmpdir(), 'harnessed-uploads-'))
    uploads = root
    process.once('exit', () => rmSync(root, { recursive: true, force: true }))
  }
  const root = uploads
  return Promise.all(
    files.map(async file => {
      const dir = join(root, String(written++))
      mkdirSync(dir)
      // basename: a name is a name, never a path out of the directory.
      const path = join(dir, basename(file.name) || 'upload')
      writeFileSync(path, new Uint8Array(await file.arrayBuffer()))
      return path
    }),
  )
}
