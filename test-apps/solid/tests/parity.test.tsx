import { fixtureParity } from '@harnessed-ts/conformance'
import { render } from '@solidjs/testing-library'
import { describe, it } from 'vitest'
import { ConformanceApp } from '../src/fixture/ConformanceApp'

/**
 * The Solid fixture must render what the React one does, view for view: the
 * catalog passing here only means the drivers agree if both fixtures are the
 * same markup. The React side is pinned to the same trees by the conformance
 * package's own test.
 */
describe('conformance: Solid fixture parity', () => {
  fixtureParity(it, async url => {
    window.history.pushState({}, '', url)
    const { container } = render(() => <ConformanceApp />)
    // jsdom replaces a srcless iframe's first document before its `load`, and the
    // frame view renders into the new body from that handler. One macrotask lets
    // `load` fire; Solid renders the new body's content synchronously.
    await new Promise(resolve => setTimeout(resolve, 0))
    return container.querySelector('[data-testid="stage"]')
  })
})
