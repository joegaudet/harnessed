import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../fixture/App'
import { firstDifference, fixtureParity } from '../src/parity'
import { fixtureTree } from '../src/fixture-tree'

/**
 * `fixtureParity` is what every port of the fixture (Glimmer, Vue, Solid,
 * Svelte, Angular) runs. Run against the React original, it must pass; against
 * a drifted tree, it must name the place the trees part.
 */
describe('fixtureParity, against the React fixture itself', () => {
  fixtureParity(it, async url => {
    window.history.pushState({}, '', url)
    const { container } = render(<App />)
    return container.querySelector('[data-testid="stage"]')
  })
})

describe('firstDifference', () => {
  function treeOf(html: string) {
    const host = document.createElement('div')
    host.innerHTML = html
    return fixtureTree(host.firstElementChild!)
  }

  it('is undefined for equal trees', () => {
    const html = '<div data-testid="stage"><label for="a">A</label></div>'
    expect(firstDifference(treeOf(html), treeOf(html))).toBeUndefined()
  })

  it('names a missing attribute by its path', () => {
    const drifted = treeOf('<div data-testid="stage"><form><label>A</label></form></div>')
    const pinned = treeOf('<div data-testid="stage"><form><label for="a">A</label></form></div>')
    expect(firstDifference(drifted, pinned)).toBe(
      'div > form > label: attribute "for" is null, expected "a"',
    )
  })

  it('names a missing or extra child', () => {
    const drifted = treeOf('<div data-testid="stage"><p>one</p></div>')
    const pinned = treeOf('<div data-testid="stage"><p>one</p><p>two</p></div>')
    expect(firstDifference(drifted, pinned)).toBe('div, child 2: rendered nothing, expected <p>')
  })

  it('names differing text', () => {
    const drifted = treeOf('<div data-testid="stage"><p>Sign  up</p></div>')
    const pinned = treeOf('<div data-testid="stage"><p>Sign in</p></div>')
    expect(firstDifference(drifted, pinned)).toBe(
      'div > p, child 1: rendered "Sign up", expected "Sign in"',
    )
  })
})
