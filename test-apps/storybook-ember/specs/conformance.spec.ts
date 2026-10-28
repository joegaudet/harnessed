import { pageSpecs, specs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { pw } from '@harnessed-ts/playwright'
import { storiesModule, StoryPage } from '@harnessed-ts/storybook/page'
import { test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type * as ViewStories from '../stories/Views.stories.gts'
import { STORY_FOR } from '../tests/views'

// A `.gts` module needs Ember's build to load; StoryPage only reads the title.
const Views = storiesModule<typeof ViewStories>({ title: 'Conformance/Views' })

/** Each view opened as a story, by URL, the way any navigating runner would. */
const context = (page: Page): ConformanceCtx => ({
  async show(view) {
    await StoryPage.goto(pw(page), Views, STORY_FOR[view])
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
