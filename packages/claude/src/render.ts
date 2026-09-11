import type { DetectedLayout } from './detect'

export interface RenderContext extends DetectedLayout {
  testIdAttribute: string
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

/**
 * Replaces the generated block and substitutes the tokens, leaving everything
 * else alone — so a re-run after an upgrade refreshes the shipped law without
 * discarding local edits outside the markers.
 */
export function renderSkill(template: string, context: RenderContext): string {
  const table = placementTable(context)

  const begin = template.indexOf(BEGIN)
  const end = template.indexOf(END)
  const withTable =
    begin === -1 || end === -1
      ? template
      : `${template.slice(0, begin + BEGIN.length)}\n${table}\n${template.slice(end)}`

  return substitute(withTable, context)
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
