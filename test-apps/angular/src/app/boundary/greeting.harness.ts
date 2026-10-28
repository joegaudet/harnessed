import { ByRole, ByTestId, ComponentHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { GREETING_TEST_ID } from './greeting'

/**
 * The other side of the boundary: a harness beside the component it drives,
 * importing that component's module — which is Angular-compiled, and is
 * type-checked here under standard decorators. `harnessedDecorators()` lowers
 * this file's decorators and `accessor` fields; if the Angular plugin compiled
 * it instead, with the app's legacy decorators, the fields would lose their
 * getters.
 */
@Harness({ host: testId(GREETING_TEST_ID) })
export class GreetingHarness extends ComponentHarness {
  @ByRole('heading', { level: 2 }) private accessor title!: Query
  @ByRole('button', { name: 'Wave' }) private accessor waveButton!: Query
  @ByTestId('greeting-waves') private accessor waveCount!: Query

  async heading(): Promise<string> {
    return this.title.text()
  }

  async wave(): Promise<void> {
    await this.waveButton.click()
  }

  async waves(): Promise<number> {
    return Number(await this.waveCount.text())
  }
}
