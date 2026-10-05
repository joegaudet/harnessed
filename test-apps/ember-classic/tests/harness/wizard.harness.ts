import { ByRole, ComponentHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'

/**
 * A harness written in the app itself, so it is compiled by this app's Babel
 * pipeline — @harnessed-ts/core/babel first, decorator-transforms after it for
 * the app's own @tracked fields. If the plugin did not claim this file, the
 * `accessor` fields would be a syntax error or would silently lose their getters.
 */
@Harness({ host: testId('page-wizard') })
export class WizardHarness extends ComponentHarness {
  @ByRole('heading', { level: 1 }) private accessor title!: Query
  @ByRole('button', { name: 'Continue' }) private accessor continueButton!: Query

  get heading(): Query {
    return this.title
  }

  async continue(): Promise<void> {
    await this.continueButton.click()
  }
}
