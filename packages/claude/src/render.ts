import type { DetectedLayout } from './detect'

export interface RenderContext extends DetectedLayout {
  testIdAttribute: string
}

/** The placement table, rendered from the repo's actual layout. */
export function placementTable(context: RenderContext): string {
  const { components, screens, harnesses, widgetHarnesses, screenHarnesses } = context
  const { widgetTestId, screenTestId, testIdAttribute } = context
  const widgetExample = widgetTestId.replace('<kebab>', 'sel-card')
  const screenExample = screenTestId.replace('<kebab>', 'checkout')

  return [
    `| Kind | Source | Harness | \`${testIdAttribute}\` |`,
    '|---|---|---|---|',
    `| Widget | \`${components}/<Name>.tsx\` | \`${widgetHarnesses}/<Name>.harness.ts\` | \`${widgetTestId}\` |`,
    `| Screen | \`${screens}/<Name>.tsx\` | \`${screenHarnesses}/<Name>.harness.ts\` | \`${screenTestId}\` |`,
    `| Route | a URL | \`${harnesses}/routes/<name>.route.ts\` | the stage element it renders into |`,
    '',
    `Examples: a \`SelCard\` widget gets \`${widgetExample}\`; a \`Checkout\` screen gets`,
    `\`${screenExample}\`.`,
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
  const widgetExample = context.widgetTestId.replace('<kebab>', 'sel-card')
  const table = placementTable(context)

  const begin = template.indexOf(BEGIN)
  const end = template.indexOf(END)
  const withTable =
    begin === -1 || end === -1
      ? template
      : `${template.slice(0, begin + BEGIN.length)}\n${table}\n${template.slice(end)}`

  return substitute(withTable, context, widgetExample)
}

export function renderRules(template: string, context: RenderContext): string {
  return substitute(template, context, context.widgetTestId.replace('<kebab>', 'sel-card'))
}

function substitute(text: string, context: RenderContext, widgetExample: string): string {
  return text
    .replaceAll('{{HARNESS_DIR}}', context.harnesses)
    .replaceAll('{{COMPONENTS_DIR}}', context.components)
    .replaceAll('{{SCREENS_DIR}}', context.screens)
    .replaceAll('{{TESTID_ATTRIBUTE}}', context.testIdAttribute)
    .replaceAll('{{WIDGET_EXAMPLE}}', widgetExample)
}

/** The `harnessed.config.ts` the generator writes. */
export function renderConfig(context: RenderContext): string {
  return `import { defineConfig } from '@harnessed/core'

/**
 * Read by three things: the runtime (\`configure()\`), @harnessed/eslint-plugin,
 * and the @harnessed/claude skill generator. Keep it as the single source of
 * truth rather than repeating any of it in their own configs.
 */
export default defineConfig({
  testIdAttribute: '${context.testIdAttribute}',
  defaultTimeout: 5000,
  layout: {
    components: '${context.components}',
    screens: '${context.screens}',
    harnesses: '${context.harnesses}',
    widgetHarnesses: '${context.widgetHarnesses}',
    screenHarnesses: '${context.screenHarnesses}',
  },
  testIdPattern: {
    widget: '${context.widgetTestId}',
    screen: '${context.screenTestId}',
  },
})
`
}
