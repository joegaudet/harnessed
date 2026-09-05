import { ByText, ChildHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { RouteHarness } from '@harnessed-ts/route'
import { ThingHarness } from './Thing.harness'

/**
 * `/thing?token=…` — one sentence on what this URL is for, and anything unusual
 * about how it becomes ready (a token round-trip, a redirect on failure).
 *
 * The type parameter declares the path's params, so `goto()` is checked against
 * the path rather than trusted.
 */
@Harness({ host: testId('stage') })
export class ThingRoute extends RouteHarness<{ token: string }> {
  // $param substitution works in the query string as well as the path.
  get path(): string {
    return '/thing?token=$token'
  }

  @ChildHarness(ThingHarness) accessor thing!: ThingHarness
  @ByText(/that link has expired/i) private accessor expiredNote!: Query

  // Required, and never empty. Usually one line against the route's own host.
  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }

  async showsExpiredNotice(): Promise<boolean> {
    return !(await this.expiredNote.isAbsent())
  }
}
