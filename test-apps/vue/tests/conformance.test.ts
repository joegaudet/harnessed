import { pageSpecs, specs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/vue'
import { describe, it } from 'vitest'
import ConformanceApp from '../src/fixture/ConformanceApp.vue'

function context(): ConformanceCtx {
  return {
    async show(view: View) {
      // Routed by `?view=` like the React App, so every driver reads the same markup.
      window.history.pushState({}, '', `/${viewSearch(view)}`)
      // Queries start at the body: the dialog teleports out of the container.
      const { baseElement } = render(ConformanceApp)
      return dom({ user: userEvent.setup(), container: baseElement as HTMLElement })
    },
  }
}

describe('conformance: dom driver, Vue fixture', () => {
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
