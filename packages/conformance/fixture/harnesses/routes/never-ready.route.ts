import { Harness, testId } from '@harnessed/core'
import { RouteHarness } from '@harnessed/route'

/** Waits for something the fixture never renders. Proves goto() awaits waitForReady. */
@Harness({ host: testId('stage') })
export class NeverReadyRoute extends RouteHarness {
  get path(): string {
    return '/'
  }

  protected async waitForReady(): Promise<void> {
    await this.elementBy(testId('never-rendered')).waitFor('visible', { timeout: 750 })
  }
}
