import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { RouteHarness } from '@harnessed-ts/route'
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
    await this.elementBy(testId('screen-step-two')).waitFor('visible')
  }
}
