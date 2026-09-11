import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { PortalDialogHarness } from '../PortalDialog.harness'

/** `/?view=dialog` — the dialog itself portals outside this page's subtree. */
@Harness({ host: testId('page-dialog') })
export class DialogPage extends PageHarness {
  override get path(): string {
    return '/?view=dialog'
  }

  @ChildHarness(PortalDialogHarness) accessor dialog!: PortalDialogHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
