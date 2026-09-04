import {
  ByLabel,
  ByPlaceholder,
  ByRole,
  ByTestId,
  ComponentHarness,
  Harness,
  testId,
} from '@harnessed/core'
import type { Query } from '@harnessed/core'

export interface Credentials {
  email?: string
  password?: string
}

/**
 * A form: labels, a placeholder, a checkbox, a select, a conditionally rendered
 * error, and a submit button whose accessible name changes with its state (so the
 * harness reads `data-status` rather than querying by the name it is asserting).
 */
@Harness({ host: testId('login-form') })
export class LoginFormHarness extends ComponentHarness {
  @ByRole('heading', { level: 1 }) private accessor title!: Query
  @ByLabel('Email') private accessor email!: Query
  @ByLabel('Password') private accessor password!: Query
  @ByLabel('Remember me') private accessor remember!: Query
  @ByLabel('Plan') private accessor plan!: Query
  @ByPlaceholder('you@example.com') private accessor emailByPlaceholder!: Query
  @ByTestId('login-submit') private accessor submit!: Query
  @ByTestId('login-error') private accessor errorLine!: Query
  @ByRole('dialog', { name: 'Confirm', global: true }) private accessor globalDialog!: Query

  async heading(): Promise<string> {
    return this.title.text()
  }

  async fillIn(credentials: Credentials): Promise<void> {
    if (credentials.email !== undefined) await this.email.fill(credentials.email)
    if (credentials.password !== undefined) await this.password.fill(credentials.password)
  }

  async values(): Promise<Required<Credentials>> {
    return {
      email: await this.email.inputValue(),
      password: await this.password.inputValue(),
    }
  }

  async emailViaPlaceholder(): Promise<string> {
    return this.emailByPlaceholder.inputValue()
  }

  async submitIt(): Promise<void> {
    await this.submit.click()
  }

  async isSubmitEnabled(): Promise<boolean> {
    return this.submit.isEnabled()
  }

  async status(): Promise<string | null> {
    return this.submit.attribute('data-status')
  }

  async rememberMe(): Promise<void> {
    await this.remember.check()
  }

  async forgetMe(): Promise<void> {
    await this.remember.uncheck()
  }

  async isRemembered(): Promise<boolean> {
    return this.remember.isChecked()
  }

  async choosePlan(value: string): Promise<void> {
    await this.plan.selectOption(value)
  }

  async chosenPlan(): Promise<string> {
    return this.plan.inputValue()
  }

  /** Absent unless the fixture was given an error — the count()/isAbsent() case. */
  async errorText(): Promise<string | null> {
    if (await this.errorLine.isAbsent()) return null
    return this.errorLine.text()
  }

  async errorCount(): Promise<number> {
    return this.errorLine.count()
  }

  /** Exposed for the matcher specs, which assert against a target directly. */
  get errorQuery(): Query {
    return this.errorLine
  }

  /** Reaches a node the host scope cannot see; used to prove `global` escapes scope. */
  async seesGlobalDialog(): Promise<boolean> {
    return (await this.globalDialog.count()) > 0
  }

  async clearEmail(): Promise<void> {
    await this.email.clear()
  }

  async focusEmail(): Promise<void> {
    await this.email.focus()
  }

  async pressInEmail(key: string): Promise<void> {
    await this.email.press(key)
  }

  async hoverSubmit(): Promise<void> {
    await this.submit.hover()
  }

  async titleIsVisible(): Promise<boolean> {
    return this.title.isVisible()
  }
}
