import { dom } from '@harnessed/dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it } from 'vitest'
import { App } from '../fixture/App'
import type { ConformanceCtx, View } from './catalog'
import { specs } from './catalog'
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

describe('conformance: dom driver', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(context())
    })
  }
})
