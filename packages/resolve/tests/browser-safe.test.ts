import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The main entry is what in-process drivers load, and some of them run in a real
 * browser (Vitest browser mode, Ember, Cypress) where a Node built-in does not
 * exist. Only `/inject` is for the test process. This reads the built ESM entry
 * and every chunk it pulls in, so `pnpm build` must run first.
 */
function moduleGraph(entry: string): Map<string, string> {
  const files = new Map<string, string>()
  const visit = (name: string): void => {
    if (files.has(name)) return
    const source = readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8')
    files.set(name, source)
    for (const [, local] of source.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)) visit(local!)
    for (const [, local] of source.matchAll(/^import\s+['"]\.\/([^'"]+)['"]/gm)) visit(local!)
  }
  visit(entry)
  return files
}

const NODE_BUILTIN =
  /(?:from\s+|^import\s+)['"](?:node:\w+|fs|path|url|module|os|crypto|process)['"]/m

describe('the main ESM entry', () => {
  it('imports no Node built-in, directly or through a shared chunk', () => {
    for (const [name, source] of moduleGraph('index.js')) {
      expect(source, `${name} imports a Node built-in`).not.toMatch(NODE_BUILTIN)
    }
  })
})
