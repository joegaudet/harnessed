import { mockSpecs, pageSpecs, specs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { dom } from '@harnessed-ts/dom'
import { resetMocks } from '@harnessed-ts/storybook/mock'
import { composeStories, setProjectAnnotations } from '@storybook/react-vite'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, it } from 'vitest'
import preview from '../.storybook/preview'
import * as ViewStories from '../stories/Views.stories'
import { STORY_FOR } from './views'

setProjectAnnotations(preview)
const stories = composeStories(ViewStories)

/** Each view is a story: rendered by Storybook, with `harnessed()` applied. */
const context = (): ConformanceCtx => ({
  async show(view) {
    await stories[STORY_FOR[view]].run()
    // Queries start at the body: the dialog portals out of the story's canvas.
    return dom({ user: userEvent.setup(), container: document.body })
  },
})

describe('conformance: portable stories', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(context())
    })
  }
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(context())
    })
  }
  // Mocked in the preview's own realm, the way `parameters.harnessed.mocks` is.
  for (const spec of mockSpecs) {
    it(spec.name, async () => {
      await spec.run({ ...context(), env: () => dom({ user: userEvent.setup() }) })
    })
  }
})

// The preview outlives a test: anything a spec left unverified fails it.
afterEach(() => resetMocks())
