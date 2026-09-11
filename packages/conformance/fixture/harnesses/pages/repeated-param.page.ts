import { Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'

/**
 * The same param twice, and a value that needs encoding. Proves replaceAll rather
 * than replace, and that values are URL-encoded.
 */
@Harness({ host: testId('page-step-two') })
export class RepeatedParamPage extends PageHarness<{ token: string }> {
  override get path(): string {
    return '/step-two?token=$token&echo=$token'
  }

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
