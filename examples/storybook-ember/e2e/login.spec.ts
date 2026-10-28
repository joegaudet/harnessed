import { pw } from '@harnessed-ts/playwright'
import { storiesModule, StoryPage } from '@harnessed-ts/storybook/page'
import { expect, test } from '@playwright/test'
import { LoginFormHarness } from '../src/harness/login-form.harness'
import type * as LoginStories from '../src/login-form.stories.gts'

// A .gts module needs Ember's build to load, which Playwright's Node process
// does not have. StoryPage only reads the meta's title.
const Login = storiesModule<typeof LoginStories>({ title: 'Forms/Login Form' })

test('the story arrives with its play function already run', async ({ page }) => {
  const story = await StoryPage.goto(pw(page), Login, 'WrongPassword')
  expect(await story.harness(LoginFormHarness).error()).toBe('Wrong password')
})

test('play: false hands the test the story before it plays', async ({ page }) => {
  const story = await StoryPage.goto(pw(page), Login, 'WrongPassword', { play: false })
  const form = story.harness(LoginFormHarness)
  expect(await form.error()).toBeNull()

  await form.signInAs('ada@example.com', 'hunter2')
  expect(await form.error()).toBeNull()
})
