import { Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'

/** Waits for something the fixture never renders. Proves readiness is awaited. */
@Harness({ host: testId('stage') })
export class NeverReadyPage extends PageHarness {
  override get path(): string {
    return '/'
  }

  protected async waitForReady(): Promise<void> {
    // Bounded, so an abandoned wait does not outlive the spec that started it.
    await this.elementBy(testId('never-rendered')).waitFor('visible', { timeout: 750 })
  }
}
