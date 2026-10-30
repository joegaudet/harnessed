import { fixtureParity } from '@harnessed-ts/conformance'
import { render } from '@testing-library/vue'
import { afterEach, describe, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ConformanceApp from '../src/fixture/ConformanceApp.vue'

/**
 * The Vue fixture must render what the React one does, view for view: the
 * catalog passing here only means the drivers agree if both fixtures are the
 * same markup. The React side is pinned to the same trees by the conformance
 * package's own test.
 */
describe('conformance: Vue fixture parity', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  fixtureParity(it, async (url, view) => {
    // The data view fetches as it mounts. React's tree is read with the request
    // still in flight, so hold this one there too.
    if (view === 'data') vi.stubGlobal('fetch', () => new Promise<never>(() => {}))
    window.history.pushState({}, '', url)
    const { container } = render(ConformanceApp)
    // jsdom replaces a srcless iframe's first document before its `load`, and the
    // frame view re-teleports into the new body from that handler. One macrotask
    // lets `load` fire; the tick after it lets the Teleport follow.
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
    return container.querySelector('[data-testid="stage"]')
  })
})
