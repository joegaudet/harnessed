import { dom } from '@harnessed-ts/dom'
// Registers the in-page transport: fetch, XHR and WebSocket are patched in jsdom.
import { resetMocks } from '@harnessed-ts/dom/mock'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, it } from 'vitest'
import { App } from '../fixture/App'
import type { ConformanceCtx, View } from './catalog'
import { specs } from './catalog'
import { mockSpecs } from './mocks.catalog'
import type { MockCtx } from './mocks.catalog'
import { pageSpecs } from './pages.catalog'
import { viewSearch } from './views'

function context(): ConformanceCtx {
  return {
    async show(view: View) {
      // Same App the playwright run drives, so both drivers read the same markup.
      window.history.pushState({}, '', `/${viewSearch(view)}`)
      const { baseElement } = render(<App />)
      return dom({ user: userEvent.setup(), container: baseElement })
    },
  }
}

function mockContext(): MockCtx {
  // jsdom's window is the network: an env needs no rendered tree to mock it.
  return { env: () => dom({ user: userEvent.setup() }), show: context().show }
}

describe('conformance: dom driver', () => {
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
  for (const spec of mockSpecs) {
    it(spec.name, async () => {
      await spec.run(mockContext())
    })
  }
})

// The window outlives a test; anything a spec left unverified fails that spec.
afterEach(() => resetMocks())
