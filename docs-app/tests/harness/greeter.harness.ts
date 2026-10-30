import { ByLabel, ByTestId, ComponentHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'

@Harness({ host: testId('greeter') })
export class GreeterHarness extends ComponentHarness {
  @ByLabel('Name') private accessor name!: Query
  @ByTestId('greeting') private accessor greeting!: Query

  async greet(value: string): Promise<string> {
    await this.name.fill(value)
    return this.greeting.text()
  }
}
