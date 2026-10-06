import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import type { RenderContext } from '../src/render'
import { renderConfig } from '../src/render'

const context: RenderContext = {
  testIdAttribute: 'data-testid',
  components: 'src/components',
  pages: 'src/pages',
  harnesses: 'tests/harnesses',
  widgetHarnesses: 'tests/harnesses/widgets',
  pageHarnesses: 'tests/harnesses/pages',
  widgetTestId: 'widget-{name}',
  pageTestId: 'page-{name}',
}

/**
 * Runs the generated file and returns what it passes to `defineConfig`. The body
 * is plain JavaScript once the import and export are taken away, so evaluating it
 * is the strictest check there is that every value survived the trip.
 */
const evaluate = (source: string): unknown => {
  const body = source
    .replace(/^import .*$/m, '')
    .replace('export default defineConfig(', 'result = defineConfig(')
  const sandbox: { defineConfig: (config: unknown) => unknown; result?: unknown } = {
    defineConfig: config => config,
  }
  runInNewContext(body, sandbox)
  return sandbox.result
}

describe('renderConfig', () => {
  it('writes every value back as it was detected', () => {
    expect(evaluate(renderConfig(context))).toEqual({
      testIdAttribute: 'data-testid',
      defaultTimeout: 5000,
      layout: {
        components: 'src/components',
        pages: 'src/pages',
        harnesses: 'tests/harnesses',
        widgetHarnesses: 'tests/harnesses/widgets',
        pageHarnesses: 'tests/harnesses/pages',
      },
      testIdPattern: { widget: 'widget-{name}', page: 'page-{name}' },
    })
  })

  it('keeps the single-quoted style for ordinary values', () => {
    expect(renderConfig(context)).toContain(`testIdAttribute: 'data-testid',`)
  })

  it('escapes a value containing a quote, a backslash or a newline', () => {
    const awkward = {
      ...context,
      components: "src/it's here",
      pages: 'src\\pages',
      harnesses: 'tests/"harnesses"',
      widgetTestId: "w-{name}'\n+ 1",
    }
    const config = evaluate(renderConfig(awkward)) as {
      layout: Record<string, string>
      testIdPattern: Record<string, string>
    }
    expect(config.layout.components).toBe("src/it's here")
    expect(config.layout.pages).toBe('src\\pages')
    expect(config.layout.harnesses).toBe('tests/"harnesses"')
    expect(config.testIdPattern.widget).toBe("w-{name}'\n+ 1")
  })
})
