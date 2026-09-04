import { Harness, testId } from '@harnessed/core'
import { RouteHarness } from '@harnessed/route'

/**
 * The same param twice, and a value that needs encoding. Proves replaceAll rather
 * than replace, and that values are URL-encoded.
 */
@Harness({ host: testId('stage') })
export class RepeatedParamRoute extends RouteHarness<{ token: string }> {
  get path(): string {
    return '/step-two?token=$token&echo=$token'
  }

  protected async waitForReady(): Promise<void> {
    await this.page.waitForSelector('[data-testid="stage"]')
  }
}
