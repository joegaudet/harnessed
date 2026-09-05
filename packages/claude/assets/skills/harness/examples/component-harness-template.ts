import {
  ByRole,
  ByTestId,
  ChildHarness,
  ComponentHarness,
  Harness,
  testId,
} from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { ChildThingHarness } from './ChildThing.harness'

export interface ThingFormData {
  name?: string
  email?: string
}

/**
 * One paragraph on what this component is and where it lives, plus anything a
 * harness author needs that is not obvious from the source — which branches
 * exist, what renders only conditionally, why a query is shaped the way it is.
 */
@Harness({ host: testId('screen-thing') })
export class ThingHarness extends ComponentHarness {
  // Element fields stay private: the public surface is behaviour.
  @ByRole('textbox', { name: /name/i }) private accessor nameInput!: Query
  @ByRole('button', { name: /submit/i }) private accessor submitBtn!: Query
  @ByTestId('thing-status') private accessor statusText!: Query

  // A nested component with its own behavioural API.
  @ChildHarness(ChildThingHarness) private accessor child!: ChildThingHarness

  // Portals and overlays render outside the host subtree.
  @ByRole('dialog', { name: /confirm/i, global: true }) private accessor confirmDialog!: Query

  // --- behaviour ---

  async submitWith(data: ThingFormData): Promise<void> {
    if (data.name !== undefined) await this.nameInput.fill(data.name)
    await this.submitBtn.click()
  }

  async fieldValues(): Promise<Required<ThingFormData>> {
    return { name: await this.nameInput.inputValue(), email: '' }
  }

  /** Conditionally rendered — isAbsent() answers immediately when it is missing. */
  async status(): Promise<string | null> {
    if (await this.statusText.isAbsent()) return null
    return this.statusText.text()
  }

  async isSubmitDisabled(): Promise<boolean> {
    return !(await this.submitBtn.isEnabled())
  }

  // A selector computed at call time — no constant for a decorator to take.
  // elementBy keeps this harness's scope; a driver query would drop it.
  private cell(row: number, column: string): Query {
    return this.elementBy(testId(`thing-cell-${row}-${column}`))
  }
}
