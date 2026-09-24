import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { FramedPanelHarness } from '../FramedPanel.harness'

/** `/?view=frame` — the page's scope chain runs through the panel into its frame. */
@Harness({ host: testId('page-frame') })
export class FramePage extends PageHarness {
  override get path(): string {
    return '/?view=frame'
  }

  @ChildHarness(FramedPanelHarness) accessor panel!: FramedPanelHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
