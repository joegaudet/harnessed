import { fixtureParity } from '@harnessed-ts/conformance'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, it } from 'vitest'
import ConformanceApp from '../src/fixture/ConformanceApp.svelte'

/**
 * The Svelte fixture must render what the React one does, view for view: the
 * catalog passing here only means the drivers agree if both fixtures are the
 * same markup. The React side is pinned to the same trees by the conformance
 * package's own test.
 */
describe('conformance: Svelte fixture parity', () => {
  fixtureParity(it, async url => {
    window.history.pushState({}, '', url)
    const { container } = render(ConformanceApp)
    // jsdom replaces a srcless iframe's first document before its `load`, and the
    // frame view mounts into the new body from that handler. One macrotask lets
    // `load` fire; the tick after it runs the effect that mounts.
    await new Promise(resolve => setTimeout(resolve, 0))
    await tick()
    return container.querySelector('[data-testid="stage"]')
  })
})
