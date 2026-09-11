import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { StepOnePage, StepTwoPage } from './wizard-step.page'

/** `/` — takes no params, so goto() must be callable with no argument. Nests pages. */
@Harness({ host: testId('page-wizard') })
export class WizardPage extends PageHarness {
  override get path(): string {
    return '/'
  }

  @ChildHarness(StepOnePage) accessor stepOne!: StepOnePage
  @ChildHarness(StepTwoPage) accessor stepTwo!: StepTwoPage

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
