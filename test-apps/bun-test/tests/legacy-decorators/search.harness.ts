import { ComponentHarness, Harness, ByRole, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'

/** Lives under a tsconfig with `experimentalDecorators`; @harnessed-ts/core/bun still lowers it. */
@Harness({ host: testId('search') })
export class SearchHarness extends ComponentHarness {
  @ByRole('searchbox') accessor box!: Query

  async search(term: string): Promise<void> {
    await this.box.fill(term)
  }
}
