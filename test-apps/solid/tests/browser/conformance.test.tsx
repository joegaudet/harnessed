import { pageSpecs, specs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { vitestBrowser } from '@harnessed-ts/vitest-browser'
import type { VitestBrowserEnv } from '@harnessed-ts/vitest-browser'
import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, it } from 'vitest'
import { ConformanceApp } from '../../src/fixture/ConformanceApp'

// Globals are off, so cleanup is explicit. It matters more than usual: a leaked
// previous tree makes strict single-target queries ambiguous.
afterEach(cleanup)

/** Puts a view on screen the way the jsdom run does: same app, routed by `?view=`. */
async function show(view: View): Promise<VitestBrowserEnv> {
  window.history.pushState({}, '', `/${viewSearch(view)}`)
  // A fresh container per test, but queries start at the body: the dialog
  // portals out of the container, exactly as it would in an app.
  const { baseElement } = render(() => <ConformanceApp />)
  return vitestBrowser({ container: baseElement })
}

const context = (): ConformanceCtx => ({ show })

describe('conformance: vitest-browser driver, Solid fixture', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(context())
    })
  }
  // Component testing: a page arrives by being rendered, not by goto(), so the
  // driver registers no navigation and `urlSpecs` do not apply.
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(context())
    })
  }
})
