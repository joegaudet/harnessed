import {
  ByLabel,
  ByRole,
  ByTestId,
  ComponentHarness,
  Harness,
  testId,
  type Query,
} from '@harnessed-ts/core'

// Tests call what the form does; only this class knows its DOM.
@Harness({ host: testId('login-form') })
export class LoginFormHarness extends ComponentHarness {
  @ByLabel('Email') private accessor email!: Query
  @ByLabel('Password') private accessor password!: Query
  @ByRole('button', { name: /sign in/i }) private accessor submit!: Query
  @ByTestId('login-error') private accessor errorLine!: Query

  async signInAs(email: string, password: string): Promise<void> {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submit.click()
  }

  async error(): Promise<string | null> {
    if (await this.errorLine.isAbsent()) return null
    return this.errorLine.text()
  }
}
