import { ChildHarness, Harness, testId } from '@harnessed/core'
import { RouteHarness } from '@harnessed/route'
import { StepTwoHarness } from '../Wizard.harness'

/**
 * `/step-two?token=$token` — substitution happens in the query string, and the
 * param is declared so goto() is checked against it.
 */
@Harness({ host: testId('stage') })
export class StepTwoRoute extends RouteHarness<{ token: string }> {
  get path(): string {
    return '/step-two?token=$token'
  }

  @ChildHarness(StepTwoHarness) accessor stepTwo!: StepTwoHarness

  protected async waitForReady(): Promise<void> {
    await this.page.waitForSelector('[data-testid="screen-step-two"]')
  }
}
