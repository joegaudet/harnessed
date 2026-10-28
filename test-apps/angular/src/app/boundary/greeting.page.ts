import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { GreetingHarness } from './greeting.harness'

/** A page file, which the same `include` pattern claims: composes the harness above. */
@Harness({ host: testId('greeting-page') })
export class GreetingPage extends PageHarness {
  @ChildHarness(GreetingHarness) accessor greeting!: GreetingHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
