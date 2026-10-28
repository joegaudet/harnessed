import type { View } from '../specs/catalog'
import { viewSearch, VIEWS } from '../specs/views'
import trees from '../fixture/trees.json'
import { fixtureTree } from './fixture-tree'
import type { FixtureNode } from './fixture-tree'

/** Defines one test in whatever runner the port uses: Vitest's `it`, QUnit's `test`, … */
export type DefineTest = (name: string, body: () => Promise<void>) => void

/**
 * Renders the port's app at `url` (`/?view=…`, as `viewSearch` builds it) and
 * returns its `[data-testid="stage"]` element, or `null` if none rendered.
 */
export type RenderStage = (url: string, view: View) => Promise<Element | null>

const PINNED = trees as unknown as Record<View, FixtureNode>

function describeNode(node: FixtureNode | string | undefined): string {
  if (node === undefined) return 'nothing'
  if (typeof node === 'string') return JSON.stringify(node)
  return `<${node.tag}${Object.entries(node.attrs)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${value}"`))
    .join('')}>`
}

/**
 * The first place two trees disagree, as a path from the stage and both sides —
 * a port's author needs "the second label has no `for`", not two pages of JSON.
 */
export function firstDifference(actual: FixtureNode, expected: FixtureNode): string | undefined {
  const walk = (a: FixtureNode, e: FixtureNode, path: string): string | undefined => {
    const here = `${path}${path === '' ? '' : ' > '}${e.tag}`
    if (a.tag !== e.tag) return `${here}: rendered ${describeNode(a)}, expected ${describeNode(e)}`
    const keys = new Set([...Object.keys(a.attrs), ...Object.keys(e.attrs)])
    for (const key of [...keys].sort()) {
      if (a.attrs[key] !== e.attrs[key]) {
        return (
          `${here}: attribute "${key}" is ${JSON.stringify(a.attrs[key] ?? null)}, ` +
          `expected ${JSON.stringify(e.attrs[key] ?? null)}`
        )
      }
    }
    const length = Math.max(a.children.length, e.children.length)
    for (let index = 0; index < length; index++) {
      const actualChild = a.children[index]
      const expectedChild = e.children[index]
      if (
        typeof actualChild === 'object' &&
        typeof expectedChild === 'object' &&
        actualChild !== null &&
        expectedChild !== null
      ) {
        const found = walk(actualChild, expectedChild, here)
        if (found !== undefined) return found
      } else if (actualChild !== expectedChild) {
        return (
          `${here}, child ${index + 1}: rendered ${describeNode(actualChild)}, ` +
          `expected ${describeNode(expectedChild)}`
        )
      }
    }
    return undefined
  }
  return walk(actual, expected, '')
}

/**
 * The fixture-parity check for a port of the fixture to another framework: one
 * test per view, each rendering the port and comparing `fixtureTree(stage)` with
 * the tree pinned from the React original. `VIEWS` is checked against `View`,
 * so a new view cannot be skipped.
 *
 * ```ts
 * fixtureParity(it, async url => {
 *   window.history.pushState({}, '', url)
 *   const { container } = render(ConformanceApp)
 *   return container.querySelector('[data-testid="stage"]')
 * })
 * ```
 */
export function fixtureParity(define: DefineTest, render: RenderStage): void {
  for (const view of VIEWS) {
    define(`"${view}" renders the same tree as the React fixture`, async () => {
      const stage = await render(`/${viewSearch(view)}`, view)
      if (stage === null) throw new Error(`fixture parity: "${view}" rendered no stage`)
      const difference = firstDifference(fixtureTree(stage), PINNED[view])
      if (difference !== undefined) {
        throw new Error(`fixture parity: "${view}" differs from the React fixture at ${difference}`)
      }
    })
  }
}
