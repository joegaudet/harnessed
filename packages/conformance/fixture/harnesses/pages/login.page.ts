import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { LoginFormHarness } from '../LoginForm.harness'

/** `/?view=login` — a page composing one component harness. */
@Harness({ host: testId('page-login') })
export class LoginPage extends PageHarness {
  override get path(): string {
    return '/?view=login'
  }

  @ChildHarness(LoginFormHarness) accessor form!: LoginFormHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
