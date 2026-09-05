import { ByRole, ByTestId, ComponentHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'

/** The dialog is portalled to document.body, outside this host's subtree. */
@Harness({ host: testId('portal-host') })
export class PortalDialogHarness extends ComponentHarness {
  @ByRole('button', { name: 'Open confirm' }) private accessor opener!: Query
  @ByRole('dialog', { name: 'Confirm', global: true }) private accessor dialog!: Query
  @ByTestId('dialog-body', { global: true }) private accessor body!: Query
  /** Deliberately NOT global — must never find the portalled node. */
  @ByTestId('dialog-body') private accessor scopedBody!: Query

  async open(): Promise<void> {
    await this.opener.click()
  }

  async isOpen(): Promise<boolean> {
    return (await this.dialog.count()) > 0
  }

  async bodyText(): Promise<string> {
    return this.body.text()
  }

  async scopedBodyCount(): Promise<number> {
    return this.scopedBody.count()
  }
}
