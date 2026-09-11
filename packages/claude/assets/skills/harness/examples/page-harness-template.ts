import { ByText, ChildHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { NextPage } from './next.page'
import { ThingHarness } from './Thing.harness'

/**
 * `/thing?token=…` — one sentence on what this page is for, and anything unusual
 * about how it becomes ready (a token round-trip, a redirect on failure).
 *
 * The type parameter declares the path's params, so `goto()` is checked against
 * the path rather than trusted. A page reached by interaction rather than URL
 * simply leaves `path` out.
 */
@Harness({ host: testId('page-thing') })
export class ThingPage extends PageHarness<{ token: string }> {
  // $param substitution works in the query string as well as the path.
  override get path(): string {
    return '/thing?token=$token'
  }

  // A page composes component harnesses and other pages alike.
  @ChildHarness(ThingHarness) accessor thing!: ThingHarness
  @ByText(/that link has expired/i) private accessor expiredNote!: Query

  // Required, and never empty. Usually one line against the page's own host.
  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }

  async showsExpiredNotice(): Promise<boolean> {
    return !(await this.expiredNote.isAbsent())
  }

  // An action that leads elsewhere hands back the page it leads to, ready.
  async continueToNext(): Promise<NextPage> {
    await this.thing.submitWith({ name: 'Ada' })
    return this.transitionTo(NextPage)
  }
}
