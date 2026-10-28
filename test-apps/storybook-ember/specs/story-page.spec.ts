import { LoginFormHarness } from '@harnessed-ts/conformance'
import { pw } from '@harnessed-ts/playwright'
import { storiesModule, StoryPage } from '@harnessed-ts/storybook/page'
import { expect, test } from '@playwright/test'
import type * as LoginStories from '../stories/LoginForm.stories'

// The stories import a `.gts` component, which needs Ember's build to load.
const Login = storiesModule<typeof LoginStories>({ title: 'Forms/Login Form' })

test('a story opens with its play function already run, as in Storybook', async ({ page }) => {
  const story = await StoryPage.goto(pw(page), Login, 'FilledIn')
  const form = story.harness(LoginFormHarness)
  expect(await form.values()).toEqual({ email: 'ada@example.com', password: 'hunter2' })
})

test('play: false opens the story in its initial state for the test to drive', async ({ page }) => {
  const story = await StoryPage.goto(pw(page), Login, 'FilledIn', { play: false })
  const form = story.harness(LoginFormHarness)
  expect(await form.values()).toEqual({ email: '', password: '' })

  await form.fillIn({ email: 'grace@example.com' })
  expect((await form.values()).email).toBe('grace@example.com')
})

test('args from the test override the story', async ({ page }) => {
  const story = await StoryPage.goto(pw(page), Login, 'Empty', {
    args: { error: 'Bad credentials' },
  })
  expect(await story.harness(LoginFormHarness).errorText()).toBe('Bad credentials')
})

test("a story whose play fails is reported with the play's own error", async ({ page }) => {
  await expect(
    StoryPage.goto(pw(page), Login, 'WithError', { args: { error: 'Something else' } }),
  ).rejects.toThrow(
    /play function of story .*forms-login-form--with-error.* threw: .*Bad credentials/s,
  )
})
