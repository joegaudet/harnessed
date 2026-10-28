import { fixtureParity } from '@harnessed-ts/conformance'
import { afterEach, describe, it, vi } from 'vitest'
import { renderAt } from './show'

/**
 * The Angular fixture must render what the React one does, view for view: the
 * catalog passing here only means the drivers agree if both fixtures are the
 * same markup. The React side is pinned to the same trees by the conformance
 * package's own test.
 */
describe('conformance: Angular fixture parity', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  fixtureParity(it, async (url, view) => {
    // The data view fetches as it mounts. React's tree is read with the request
    // still in flight, so hold this one there too.
    if (view === 'data') vi.stubGlobal('fetch', () => new Promise<never>(() => {}))
    const fixture = await renderAt(url)
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="stage"]')
  })
})
