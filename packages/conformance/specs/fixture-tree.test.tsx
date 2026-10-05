import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../fixture/App'
import { fixtureTree } from '../src/fixture-tree'
import type { FixtureNode } from '../src/fixture-tree'
import type { View } from './catalog'
import { VIEWS, viewSearch } from './views'

/**
 * Pins what each React view renders to `fixture/trees.json`. A port of the
 * fixture to another framework (the Ember app's Glimmer copy) is checked
 * against the same file, so the two cannot drift apart unnoticed.
 *
 * Changed the fixture on purpose? `UPDATE_FIXTURE_TREES=1 pnpm test:dom`, then
 * update every port until its own parity test passes again.
 */
// A path, not a URL: under the jsdom environment import.meta.url is not file://.
const FILE = join(import.meta.dirname, '../fixture/trees.json')

function treeOf(view: View): FixtureNode {
  window.history.pushState({}, '', `/${viewSearch(view)}`)
  const { container, unmount } = render(<App />)
  const tree = fixtureTree(container.querySelector('[data-testid="stage"]')!)
  // Several views render in one test when writing the file; leave nothing behind.
  unmount()
  return tree
}

describe('fixture trees', () => {
  if (process.env.UPDATE_FIXTURE_TREES === '1') {
    it('writes fixture/trees.json', () => {
      const trees = Object.fromEntries(VIEWS.map(view => [view, treeOf(view)]))
      writeFileSync(FILE, `${JSON.stringify(trees, null, 2)}\n`)
    })
    return
  }

  const pinned = JSON.parse(readFileSync(FILE, 'utf8')) as Record<View, FixtureNode>
  for (const view of VIEWS) {
    it(`the React fixture still renders the pinned tree for "${view}"`, () => {
      expect(treeOf(view)).toEqual(pinned[view])
    })
  }
})
