import { pageSpecs, specs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { pw } from '@harnessed-ts/playwright'
import { StoryPage } from '@harnessed-ts/storybook/page'
import { test } from '@playwright/test'
import type { Page } from '@playwright/test'
import * as ViewStories from '../stories/Views.stories'
import { STORY_FOR } from '../tests/views'

/** Each view opened as a story, by URL, the way any navigating runner would. */
const context = (page: Page): ConformanceCtx => ({
  async show(view) {
    await StoryPage.goto(pw(page), ViewStories, STORY_FOR[view])
    return pw(page)
  },
})

for (const spec of specs) {
  test(spec.name, async ({ page }) => {
    await spec.run(context(page))
  })
}

for (const spec of pageSpecs) {
  test(`page: ${spec.name}`, async ({ page }) => {
    await spec.run(context(page))
  })
}
