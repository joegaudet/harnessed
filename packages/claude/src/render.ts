import type { DetectedLayout, Runner } from './detect'

export interface RenderContext extends DetectedLayout {
  testIdAttribute: string
  /** The repo's test runners; the skill documents these and no others. */
  runners?: Runner[]
}

interface RunnerDoc {
  title: string
  env: string
  assert: string
}

/** How a test builds an env and asserts, per runner. */
const RUNNER_DOCS: Record<Runner, RunnerDoc> = {
  ember: {
    title: 'Ember (`@harnessed-ts/ember`)',
    env: '`new CheckoutPage(ember())` in a rendering or application test; `goto()` drives the router in application tests',
    assert:
      '`await assert.harness(page.total).readsAs(/^\\$/)` (`install(QUnit)` from `@harnessed-ts/qunit` in tests/test-helper)',
  },
  cypress: {
    title: 'Cypress (`@harnessed-ts/cypress`)',
    env: '`cy.visitPage(CheckoutPage)` then `cy.harness(CheckoutPage, page => page.pay())` — never `cy.*` inside the callback',
    assert:
      '`await expect(page.total).to.readAs(/^\\$/)` inside the callback (`chai.use(harnessedChai)` from `@harnessed-ts/chai`)',
  },
  webdriverio: {
    title: 'WebdriverIO (`@harnessed-ts/webdriverio`)',
    env: '`new CheckoutPage(wdio(browser))`, then `await page.goto()`',
    assert: '`await expect(page.total).toReadAs(/^\\$/)` (`@harnessed-ts/webdriverio/matchers`)',
  },
  testcafe: {
    title: 'TestCafe (`@harnessed-ts/testcafe`)',
    env: '`new CheckoutPage(testcafe(t))` inside a `test(…, async t => …)`',
    assert:
      '`await t.expect(await page.total.text()).match(/^\\$/)` — or Chai through `@harnessed-ts/chai`',
  },
  puppeteer: {
    title: 'Puppeteer (`@harnessed-ts/puppeteer`)',
    env: '`new CheckoutPage(puppeteer(page, { baseURL }))`, then `await checkout.goto()`',
    assert:
      '`await expect(page.total).toReadAs(/^\\$/)` (`@harnessed-ts/puppeteer/matchers`, Vitest or Jest)',
  },
  playwright: {
    title: 'Playwright (`@harnessed-ts/playwright`)',
    env: '`new CheckoutPage(pw(page))`, then `await checkout.goto()`',
    assert: '`await expect(page.total).toReadAs(/^\\$/)` (`@harnessed-ts/playwright/matchers`)',
  },
  'vitest-browser': {
    title: 'Vitest browser mode (`@harnessed-ts/vitest-browser`)',
    env: '`render(<Checkout />)` then `new CheckoutPage(vitestBrowser())`',
    assert: '`await expect(page.total).toReadAs(/^\\$/)` (`@harnessed-ts/vitest-browser/matchers`)',
  },
  'testing-library': {
    title: 'Testing Library / jsdom (`@harnessed-ts/dom`)',
    env: '`render(<Checkout />)` then `new CheckoutPage(dom({ user: userEvent.setup() }))`',
    assert: '`await expect(page.total).toReadAs(/^\\$/)` (`@harnessed-ts/dom/matchers`)',
  },
  gherkin: {
    title: 'Gherkin (`@harnessed-ts/gherkin`)',
    env: 'keep pages in the scenario world, never a module-level `let`; name them with `definePages` and the `{page}` parameter type',
    assert: "the runner's own assertion style, as above, inside the step",
  },
}

/** The runners section of the skill: how to build an env and assert, per runner. */
export function runnersSection(runners: readonly Runner[]): string {
  if (runners.length === 0) {
    return 'No test runner was detected. Re-run `npx @harnessed-ts/claude install` after adding one.'
  }
  return runners
    .map(runner => {
      const doc = RUNNER_DOCS[runner]
      return [`### ${doc.title}`, '', `- Env: ${doc.env}`, `- Assert: ${doc.assert}`].join('\n')
    })
    .join('\n\n')
}

/** The example test id shown in the docs, derived from the repo's own pattern. */
function widgetExampleOf(context: RenderContext): string {
  return context.widgetTestId.replace('<kebab>', 'sel-card')
}

/** The placement table, rendered from the repo's actual layout. */
export function placementTable(context: RenderContext): string {
  const { components, pages, widgetHarnesses, pageHarnesses } = context
  const { widgetTestId, pageTestId, testIdAttribute } = context
  const widgetExample = widgetExampleOf(context)
  const pageExample = pageTestId.replace('<kebab>', 'checkout')

  return [
    `| Kind | Source | Harness | \`${testIdAttribute}\` |`,
    '|---|---|---|---|',
    `| Widget | \`${components}/<Name>.tsx\` | \`${widgetHarnesses}/<Name>.harness.ts\` | \`${widgetTestId}\` |`,
    `| Page | \`${pages}/<Name>.tsx\`, or a URL | \`${pageHarnesses}/<name>.page.ts\` | \`${pageTestId}\` |`,
    '',
    'A page with a `path` is reachable by `goto()`; one without is reached by interaction.',
    '',
    `Examples: a \`SelCard\` widget gets \`${widgetExample}\`; a \`Checkout\` page gets`,
    `\`${pageExample}\`.`,
  ].join('\n')
}

const BEGIN = '<!-- BEGIN GENERATED: placement -->'
const END = '<!-- END GENERATED: placement -->'
const RUNNERS_BEGIN = '<!-- BEGIN GENERATED: runners -->'
const RUNNERS_END = '<!-- END GENERATED: runners -->'

/** Replaces the content between two markers, or leaves the text alone if they are missing. */
function fill(template: string, begin: string, end: string, content: string): string {
  const from = template.indexOf(begin)
  const to = template.indexOf(end)
  if (from === -1 || to === -1) return template
  return `${template.slice(0, from + begin.length)}\n${content}\n${template.slice(to)}`
}

/**
 * Replaces the generated block and substitutes the tokens, leaving everything
 * else alone — so a re-run after an upgrade refreshes the shipped law without
 * discarding local edits outside the markers.
 */
export function renderSkill(template: string, context: RenderContext): string {
  const withTable = fill(template, BEGIN, END, placementTable(context))
  const withRunners = fill(
    withTable,
    RUNNERS_BEGIN,
    RUNNERS_END,
    runnersSection(context.runners ?? []),
  )
  return substitute(withRunners, context)
}

export function renderRules(template: string, context: RenderContext): string {
  return substitute(template, context)
}

function substitute(text: string, context: RenderContext): string {
  return text
    .replaceAll('{{HARNESS_DIR}}', context.harnesses)
    .replaceAll('{{COMPONENTS_DIR}}', context.components)
    .replaceAll('{{PAGES_DIR}}', context.pages)
    .replaceAll('{{TESTID_ATTRIBUTE}}', context.testIdAttribute)
    .replaceAll('{{WIDGET_EXAMPLE}}', widgetExampleOf(context))
}

/** The `harnessed.config.ts` the generator writes. */
export function renderConfig(context: RenderContext): string {
  return `import { defineConfig } from '@harnessed-ts/core'

/**
 * Where this repo keeps its harnesses, and what its test ids look like.
 *
 * Nothing loads this file automatically yet. Pass the runtime half to
 * \`configure()\`, give \`layout.harnesses\` to @harnessed-ts/eslint-plugin as rule
 * options, and re-run \`npx @harnessed-ts/claude install\` after changing it.
 */
export default defineConfig({
  testIdAttribute: '${context.testIdAttribute}',
  defaultTimeout: 5000,
  layout: {
    components: '${context.components}',
    pages: '${context.pages}',
    harnesses: '${context.harnesses}',
    widgetHarnesses: '${context.widgetHarnesses}',
    pageHarnesses: '${context.pageHarnesses}',
  },
  testIdPattern: {
    widget: '${context.widgetTestId}',
    page: '${context.pageTestId}',
  },
})
`
}
