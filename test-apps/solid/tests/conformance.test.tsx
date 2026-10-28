import { pageSpecs, specs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { dom } from '@harnessed-ts/dom'
import { render } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, it } from 'vitest'
import { ConformanceApp } from '../src/fixture/ConformanceApp'

function context(): ConformanceCtx {
  return {
    async show(view: View) {
      // Routed by `?view=` like the React App, so every driver reads the same markup.
      window.history.pushState({}, '', `/${viewSearch(view)}`)
      // Queries start at the body: the dialog portals out of the container.
      const { baseElement } = render(() => <ConformanceApp />)
      return dom({ user: userEvent.setup(), container: baseElement })
    },
  }
}

describe('conformance: dom driver, Solid fixture', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(context())
    })
  }
  // A page arrives here by being rendered, not by goto(): the shape of a jsdom test.
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(context())
    })
  }
})
