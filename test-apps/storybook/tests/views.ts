import type { View } from '@harnessed-ts/conformance'
import type { StoryName } from '@harnessed-ts/storybook/page'
import type * as ViewStories from '../stories/Views.stories'

/** Which story shows which view; a `View` left out here is a type error. */
export const STORY_FOR: Record<View, StoryName<typeof ViewStories>> = {
  login: 'Login',
  'login-error': 'LoginError',
  'login-late-duplicates': 'LoginLateDuplicates',
  cards: 'Cards',
  dialog: 'Dialog',
  frame: 'Frame',
  wizard: 'Wizard',
}
