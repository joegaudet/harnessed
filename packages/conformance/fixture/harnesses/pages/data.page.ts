import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { UsersApi } from '../../apis/users.api'
import { DataScreenHarness } from '../DataScreen.harness'

/** `/?view=data` — loads a user as it arrives, so its mocks must be in place first. */
@Harness({ host: testId('page-data') })
export class DataPage extends PageHarness {
  override get path(): string {
    return '/?view=data'
  }

  /** Installed before `goto()` navigates; a test's own mocks override it. */
  override get mocks(): readonly unknown[] {
    return [UsersApi]
  }

  @ChildHarness(DataScreenHarness) accessor screen!: DataScreenHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
