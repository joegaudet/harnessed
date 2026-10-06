import { GHERKIN_ADAPTERS, RUNNERS } from './detect'
import type { DetectedLayout, GherkinAdapter, Runner } from './detect'

/** What, beyond the runner list, decides how each runner is documented. */
export interface RunnerVariants {
  /**
   * The `@harnessed-ts/gherkin` adapters the repo uses. Empty or missing while
   * `gherkin` is a runner means unknown, and every adapter is shown.
   */
  gherkinAdapters?: GherkinAdapter[]
  /** Ember tests may run under Vitest (`ember-vitest`), so show that assertion too. */
  emberUnderVitest?: boolean
}

export interface RenderContext extends DetectedLayout, RunnerVariants {
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
    env: "`import '@harnessed-ts/cypress/support'` in the support file (`cypress/support/e2e.ts`) registers the commands; then `cy.visitPage(CheckoutPage)` and `cy.harness(CheckoutPage, page => page.pay())` — never `cy.*` inside the callback",
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
    env: '`new CheckoutPage(puppeteer(page, { baseURL }))` with a page from `browser.newPage()`, then `await checkout.goto()`',
    assert:
      "`await expect(page.total).toReadAs(/^\\$/)` — under Vitest, `import '@harnessed-ts/puppeteer/matchers'` in a setup file; under Jest, `expect.extend(harnessMatchers)` from `@harnessed-ts/core`",
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

/** Where each Gherkin runner's world comes from. */
const GHERKIN_DOCS: Record<GherkinAdapter, string> = {
  'playwright-bdd':
    "playwright-bdd: `withWorld(test)` from `'@harnessed-ts/gherkin/playwright-bdd'`; steps destructure `{ world }`",
  cucumber:
    "cucumber-js: extend `HarnessedWorld` from `'@harnessed-ts/gherkin/cucumber'`, set `this.env` in a `Before`, open pages with `this.open(name)`",
  cypress:
    "Cypress (`@badeball/cypress-cucumber-preprocessor`): `cypressWorld()` from `'@harnessed-ts/gherkin/cypress'`; run harness calls inside `cy.harnessEnv`",
  yadda:
    "ember-cli-yadda: `yaddaWorld().steps({ pages, env: () => ember() })` from `'@harnessed-ts/gherkin/yadda'`; the `$page` term is built from the registry (`pageDictionary`)",
}

/** The adapters to document: the detected ones, or all of them when unknown. */
function gherkinAdaptersOf(variants: RunnerVariants): GherkinAdapter[] {
  const adapters = variants.gherkinAdapters ?? []
  return adapters.length > 0 ? adapters : [...GHERKIN_ADAPTERS]
}

/** The worked example files written for these runners, by file name. */
export function exampleFiles(runners: readonly Runner[], variants: RunnerVariants = {}): string[] {
  return runners.flatMap(runner =>
    runner === 'gherkin'
      ? gherkinAdaptersOf(variants).map(adapter => `gherkin-${adapter}.test-example.ts`)
      : [`${runner}.test-example.ts`],
  )
}

/** Every example file any runner can have: what a re-run may need to remove. */
export function allExampleFiles(): string[] {
  return exampleFiles(RUNNERS, { gherkinAdapters: [...GHERKIN_ADAPTERS] })
}

function runnerLines(runner: Runner, variants: RunnerVariants): string[] {
  const doc = RUNNER_DOCS[runner]
  const lines = [`- Env: ${doc.env}`, `- Assert: ${doc.assert}`]
  if (runner === 'ember' && variants.emberUnderVitest === true) {
    lines.push(
      '- Under Vitest (`ember-vitest`): `await expect(page.total).to.readAs(/^\\$/)` (`chai.use(harnessedChai)` from `@harnessed-ts/chai` in the Vitest setup file)',
    )
  }
  if (runner === 'gherkin') {
    lines.push(...gherkinAdaptersOf(variants).map(adapter => `- ${GHERKIN_DOCS[adapter]}`))
  }
  return lines
}

/** The runners section of the skill: how to build an env and assert, per runner. */
export function runnersSection(runners: readonly Runner[], variants: RunnerVariants = {}): string {
  if (runners.length === 0) {
    return 'No test runner was detected. Re-run `npx @harnessed-ts/claude install` after adding one.'
  }
  const examples = exampleFiles(runners, variants).map(file => `\`examples/${file}\``)
  return [
    `Worked examples: ${examples.join(', ')}.`,
    ...runners.map(runner =>
      [`### ${RUNNER_DOCS[runner].title}`, '', ...runnerLines(runner, variants)].join('\n'),
    ),
  ].join('\n\n')
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
    runnersSection(context.runners ?? [], context),
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

/**
 * A single-quoted TypeScript string literal holding exactly `value`.
 *
 * JSON.stringify does the escaping -- backslashes, control characters, double
 * quotes -- and the result is turned into the single-quoted form the rest of the
 * file uses: `\"` needs no escape inside single quotes, and `'` does. Matching
 * `\"` cannot misfire, because JSON never leaves a bare `"` after an escaped
 * backslash.
 */
function literal(value: string): string {
  const escaped = JSON.stringify(value).slice(1, -1).replaceAll('\\"', '"').replaceAll("'", "\\'")
  return `'${escaped}'`
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
  testIdAttribute: ${literal(context.testIdAttribute)},
  defaultTimeout: 5000,
  layout: {
    components: ${literal(context.components)},
    pages: ${literal(context.pages)},
    harnesses: ${literal(context.harnesses)},
    widgetHarnesses: ${literal(context.widgetHarnesses)},
    pageHarnesses: ${literal(context.pageHarnesses)},
  },
  testIdPattern: {
    widget: ${literal(context.widgetTestId)},
    page: ${literal(context.pageTestId)},
  },
})
`
}
