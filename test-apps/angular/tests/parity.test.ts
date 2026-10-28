import { fixtureParity } from '@harnessed-ts/conformance'
import { describe, it } from 'vitest'
import { renderAt } from './show'

/**
 * The Angular fixture must render what the React one does, view for view: the
 * catalog passing here only means the drivers agree if both fixtures are the
 * same markup. The React side is pinned to the same trees by the conformance
 * package's own test.
 */
describe('conformance: Angular fixture parity', () => {
  fixtureParity(it, async url => {
    const fixture = await renderAt(url)
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="stage"]')
  })
})
