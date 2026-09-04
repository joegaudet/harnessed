import { ByRole, ByTestId, ComponentHarness, Harness, testId } from '@harnessed/core'
import type { Query } from '@harnessed/core'

/**
 * Shared shape for both wizard steps: a level-1 title and nothing else in common.
 * The base carries the decorated fields; each subclass supplies only its own host,
 * which is the inheritance case @Harness has to survive.
 */
export abstract class WizardStepHarness extends ComponentHarness {
  @ByRole('heading', { level: 1 }) private accessor title!: Query

  async heading(): Promise<string> {
    return this.title.text()
  }
}

@Harness({ host: testId('screen-step-one') })
export class StepOneHarness extends WizardStepHarness {
  @ByRole('button', { name: 'Continue' }) private accessor continueBtn!: Query

  async continue(): Promise<void> {
    await this.continueBtn.click()
  }
}

@Harness({ host: testId('screen-step-two') })
export class StepTwoHarness extends WizardStepHarness {
  @ByTestId('step-two-token') private accessor tokenLine!: Query
  @ByTestId('step-two-expired') private accessor expiredNote!: Query

  async token(): Promise<string | null> {
    if (await this.tokenLine.isAbsent()) return null
    return this.tokenLine.text()
  }

  async showsExpiredNotice(): Promise<boolean> {
    return (await this.expiredNote.count()) > 0
  }
}
