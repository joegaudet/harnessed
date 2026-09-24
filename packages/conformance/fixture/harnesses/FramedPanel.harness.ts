import {
  ByLabel,
  ByRole,
  ByTestId,
  ChildHarness,
  ComponentHarness,
  frame,
  Harness,
  testId,
} from '@harnessed-ts/core'
import type { Query, WaitOptions } from '@harnessed-ts/core'

/** The counter, as it would be written with no idea it ends up inside a frame. */
@Harness({ host: testId('counter') })
export class CounterHarness extends ComponentHarness {
  @ByTestId('frame-count') private accessor total!: Query
  @ByRole('button', { name: 'Add one' }) private accessor adder!: Query
  @ByTestId('not-rendered') private accessor missing!: Query
  @ByLabel('Note') private accessor note!: Query
  /** Portalled outside the host, still inside the frame's document. */
  @ByTestId('frame-toast', { global: true }) private accessor toast!: Query

  async text(options?: WaitOptions): Promise<string> {
    return this.total.text(options)
  }

  async addOne(): Promise<void> {
    await this.adder.click()
  }

  async missingCount(): Promise<number> {
    return this.missing.count()
  }

  async writeNote(value: string): Promise<void> {
    await this.note.fill(value)
  }

  async pressInNote(key: string): Promise<void> {
    await this.note.press(key)
  }

  async noteValue(): Promise<string> {
    return this.note.inputValue()
  }

  async toastTexts(): Promise<string[]> {
    return this.toast.texts()
  }

  async isVisible(): Promise<boolean> {
    return this.total.isVisible()
  }

  async waitVisible(options?: WaitOptions): Promise<void> {
    await this.total.waitFor('visible', options)
  }

  async waitHidden(options?: WaitOptions): Promise<void> {
    await this.total.waitFor('hidden', options)
  }
}

@Harness({ host: testId('frame-host') })
export class FramedPanelHarness extends ComponentHarness {
  @ChildHarness(CounterHarness, { frame: testId('framed') }) accessor counter!: CounterHarness
  /** Outside the frame: must find only the decoy, never the counter's line. */
  @ByTestId('frame-count') private accessor outside!: Query
  @ByRole('button', { name: 'Hide frame' }) private accessor hider!: Query

  async outsideTexts(): Promise<string[]> {
    return this.outside.texts()
  }

  async hideFrame(): Promise<void> {
    await this.hider.click()
  }

  /** A frame marker on a `<p>`: there is no document to enter. */
  counterInWrongElement(): CounterHarness {
    return this.childHarness(CounterHarness, { frame: testId('frame-count') })
  }

  counterByMethod(): CounterHarness {
    return this.childHarness(CounterHarness, { frame: testId('framed') })
  }
}

@Harness({ host: frame(testId('framed')) })
export class FrameHarness extends ComponentHarness {
  @ByTestId('frame-count') private accessor total!: Query

  async title(): Promise<string | null> {
    return this.self.attribute('title')
  }

  async text(): Promise<string> {
    return this.total.text()
  }
}
