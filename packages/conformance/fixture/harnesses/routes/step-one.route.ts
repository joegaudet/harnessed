import { ChildHarness, Harness, testId } from '@harnessed/core'
import { RouteHarness } from '@harnessed/route'
import { StepOneHarness, StepTwoHarness } from '../Wizard.harness'

/** `/` — takes no params, so goto() must be callable with no argument. */
@Harness({ host: testId('stage') })
export class StepOneRoute extends RouteHarness {
  get path(): string {
    return '/'
  }

  @ChildHarness(StepOneHarness) accessor stepOne!: StepOneHarness
  @ChildHarness(StepTwoHarness) accessor stepTwo!: StepTwoHarness

  protected async waitForReady(): Promise<void> {
    await this.page.waitForSelector('[data-testid="screen-step-one"]')
  }
}
