import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import type { PageApi } from '../src/page-api'

/**
 * The injectable build is only useful if it stands alone: a page reached by
 * WebdriverIO or Puppeteer has no module loader, no `node_modules`, and none of
 * the test process's config. These run the built file in a blank jsdom window,
 * the way a remote driver would, so `pnpm build` must run first.
 */
const source = readFileSync(new URL('../dist/inject.global.js', import.meta.url), 'utf8')
const options = { testIdAttribute: 'data-testid', timeout: 200 }

function page(html: string): { api: PageApi; document: Document } {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only' })
  dom.window.eval(source)
  const api = (dom.window as unknown as Record<string, PageApi>).__harnessedResolve
  if (api === undefined) throw new Error('the injected build did not install its global')
  return { api, document: dom.window.document }
}

describe('the injectable build', () => {
  it('has no imports left to resolve', () => {
    expect(source).not.toMatch(/\brequire\(["']/)
    expect(source).not.toMatch(/^\s*import\s/m)
  })

  it('installs its API and resolves by role with level', async () => {
    const { api } = page('<h1>Top</h1><h2>Sub</h2>')
    const heading = await api.one(
      null,
      [],
      { type: 'role', role: 'heading', options: { level: 2 } },
      options,
    )
    expect(heading.textContent).toBe('Sub')
  })

  it('applies the testIdAttribute it is handed, not a default', async () => {
    const { api } = page('<p data-test="x">hit</p><p data-testid="x">miss</p>')
    const found = api.oneNow(
      null,
      [],
      { type: 'testId', testId: 'x' },
      { ...options, testIdAttribute: 'data-test' },
    )
    expect(found?.textContent).toBe('hit')
  })

  it('keeps scope: a match outside the root is not found', () => {
    const { api } = page('<section data-testid="a"><b>in</b></section><b>out</b>')
    const all = api.allNow(
      null,
      [{ type: 'testId', testId: 'a' }],
      { type: 'text', text: /in|out/ },
      options,
    )
    expect(all.map(node => node.textContent)).toEqual(['in'])
  })

  it('is strict: several matches is an error naming the selector, never a pick', () => {
    const { api } = page('<button>Go</button><button>Go</button>')
    expect(() =>
      api.oneNow(null, [], { type: 'role', role: 'button', options: { name: 'Go' } }, options),
    ).toThrow(/strict mode violation/)
  })

  it('answers absence at once: count is 0 and oneNow is null', async () => {
    const { api } = page('<p>nothing here</p>')
    const started = Date.now()
    expect(await api.count(null, [], { type: 'testId', testId: 'missing' }, options)).toBe(0)
    expect(api.oneNow(null, [], { type: 'testId', testId: 'missing' }, options)).toBeNull()
    expect(Date.now() - started).toBeLessThan(150)
  })

  it('starts from the root it is handed', () => {
    const { api, document } = page('<div id="r"><i>a</i></div><i>a</i>')
    const root = document.getElementById('r')
    expect(api.allNow(root, [], { type: 'text', text: 'a' }, options)).toHaveLength(1)
  })
})

describe('selectors over the wire', () => {
  it('round-trips a RegExp through JSON, which a remote driver forces', async () => {
    const { encodeSelector } = await import('../src/wire')
    const { api } = page('<button>Save draft</button><button>Cancel</button>')
    const wire = JSON.parse(
      JSON.stringify(encodeSelector({ type: 'role', role: 'button', options: { name: /save/i } })),
    )
    const found = api.oneNow(null, [], wire, options)
    expect(found?.textContent).toBe('Save draft')
  })
})

describe('the Node-side inject entry', () => {
  const built = (file: string): string =>
    readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8')

  /** The file and every shared chunk it pulls in, transitively. */
  const graph = (file: string, seen = new Set<string>()): string[] => {
    if (seen.has(file)) return []
    seen.add(file)
    const code = built(file)
    const chunks = [...code.matchAll(/["']\.\/(chunk-[\w-]+\.c?js)["']/g)].map(match => match[1]!)
    return [code, ...chunks.flatMap(chunk => graph(chunk, seen))]
  }

  it('loads neither the resolver nor Testing Library into the test process', () => {
    for (const file of ['inject.js', 'inject.cjs']) {
      for (const code of graph(file)) {
        expect(code, file).not.toMatch(/@testing-library|@harnessed-ts\/core/)
      }
    }
  })

  it('loads and finds the injectable build from CJS under any document global', async () => {
    const { createRequire } = await import('node:module')
    const requireCjs = createRequire(import.meta.url)
    const entry = requireCjs.resolve('../dist/inject.cjs')
    const saved = (globalThis as Record<string, unknown>).document
    // Both shapes a jsdom-style global takes; the second broke tsup's shim at load.
    for (const baseURI of ['http://localhost:3000/', 'about:blank']) {
      ;(globalThis as Record<string, unknown>).document = { baseURI }
      try {
        delete requireCjs.cache[entry]
        const { injectPath } = requireCjs(entry) as { injectPath(): string }
        expect(injectPath(), baseURI).toMatch(/dist[/\\]inject\.global\.js$/)
      } finally {
        ;(globalThis as Record<string, unknown>).document = saved
      }
    }
  })
})
