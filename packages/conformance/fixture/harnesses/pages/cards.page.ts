import { ChildHarness, Harness, testId } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { CardGridHarness } from '../CardGrid.harness'

/** `/?view=cards` — the decoy hint sits inside this page but outside the grid. */
@Harness({ host: testId('page-cards') })
export class CardsPage extends PageHarness {
  override get path(): string {
    return '/?view=cards'
  }

  @ChildHarness(CardGridHarness) accessor grid!: CardGridHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}
