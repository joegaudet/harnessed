import { DialogPage, FramePage, LoginPage, WizardPage } from '@harnessed-ts/conformance'
import type { View } from '@harnessed-ts/conformance'
import type { EnvConfig } from '@harnessed-ts/core'

/** What each environment supplies: a way onto a fixture view, and a beat per step. */
export interface Demo {
  /** Puts the view on screen and returns the env the harnesses are built with. */
  show(view: View): Promise<EnvConfig>
  /** Announces the next step: a recorder pauses on the last one, then notes this one. */
  step(label: string): Promise<void>
}

/** The demo's only assertion: it fails the run rather than recording a wrong story. */
export function check<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`demo: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

/**
 * The flow every recording shows, written once. RTL, Playwright and Cypress each
 * run this exact function against the React fixture or its Ember copy; nothing
 * in it knows which. The compositor prints this function beside the footage.
 */
export async function demo({ show, step }: Demo) {
  await step('Read the sign-in error')
  const login = new LoginPage(await show('login-error'))
  check(await login.form.errorText(), 'Bad credentials')

  await step('Sign in again')
  await login.form.fillIn({
    email: 'ada@example.com',
    password: 'correct horse',
  })
  await login.form.submitIt()
  check(await login.form.status(), 'done')

  await step('Click inside an iframe')
  const { panel } = new FramePage(await show('frame'))
  await panel.counter.addOne()
  check(await panel.counter.text(), 'Clicked 1 times')

  await step('Open the dialog')
  const { dialog } = new DialogPage(await show('dialog'))
  await dialog.open()
  check(await dialog.bodyText(), 'Are you sure?')

  await step('Walk the wizard')
  const wizard = new WizardPage(await show('wizard'))
  const stepTwo = await wizard.stepOne.continue()
  check(await stepTwo.heading(), 'Step two')
}
