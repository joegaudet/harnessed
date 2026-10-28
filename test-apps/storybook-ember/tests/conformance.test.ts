import { pageSpecs, specs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { dom } from '@harnessed-ts/dom'
import { composeStories, setProjectAnnotations, settled } from '@harnessed-ts/storybook/ember'
import userEvent from '@testing-library/user-event'
import { describe, it } from 'vitest'
import preview from '../.storybook/preview'
import * as ViewStories from '../stories/Views.stories.gts'
import { STORY_FOR } from './views'

setProjectAnnotations(preview)
const stories = composeStories(ViewStories)

/** Each view is a story: rendered by the Ember renderer, with `harnessed()` applied. */
const context = (): ConformanceCtx => ({
  async show(view) {
    await stories[STORY_FOR[view]].run()
    // Queries start at the body: the dialog portals out of the story's canvas.
    return dom({ user: userEvent.setup(), container: document.body, afterAction: () => settled() })
  },
})

describe('conformance: portable Ember stories', () => {
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
})
