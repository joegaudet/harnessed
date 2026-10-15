import { pw } from '@harnessed-ts/playwright'
import { StoryPage } from '@harnessed-ts/storybook/page'
import { expect, test } from '@playwright/test'
import { LoginFormHarness } from '../src/LoginForm.harness'
import * as LoginStories from '../src/LoginForm.stories'

test('the story arrives with its play function already run', async ({ page }) => {
  const story = await StoryPage.goto(pw(page), LoginStories, 'WrongPassword')
  expect(await story.harness(LoginFormHarness).error()).toBe('Wrong password')
})

test('play: false hands the test the story before it plays', async ({ page }) => {
  const story = await StoryPage.goto(pw(page), LoginStories, 'WrongPassword', { play: false })
  const form = story.harness(LoginFormHarness)
  expect(await form.error()).toBeNull()

  await form.signInAs('ada@example.com', 'hunter2')
  expect(await form.error()).toBeNull()
})
