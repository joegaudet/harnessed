import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { FramedPanelHarness } from '../FramedPanel.harness'

/** The framed counter written as a page: its `path` belongs to the framed app. */
@Harness({ host: testId('counter') })
export class CounterPage extends PageHarness {
  override get path(): string {
    return '/counter'
  }

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}

/** `/?view=frame` — the page's scope chain runs through the panel into its frame. */
@Harness({ host: testId('page-frame') })
export class FramePage extends PageHarness {
  override get path(): string {
    return '/?view=frame'
  }

  @ChildHarness(FramedPanelHarness) accessor panel!: FramedPanelHarness
  @ChildHarness(CounterPage, { frame: testId('framed') }) accessor counter!: CounterPage

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
