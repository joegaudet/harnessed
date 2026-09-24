import {
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

  async text(options?: WaitOptions): Promise<string> {
    return this.total.text(options)
  }

  async addOne(): Promise<void> {
    await this.adder.click()
  }

  async missingCount(): Promise<number> {
    return this.missing.count()
  }
}

/** Reaches an ordinary harness through `@ChildHarness(…, { frame })`. */
@Harness({ host: testId('frame-host') })
export class FramedPanelHarness extends ComponentHarness {
  @ChildHarness(CounterHarness, { frame: testId('framed') }) accessor counter!: CounterHarness
  /** Outside the frame: must find only the decoy, never the counter's line. */
  @ByTestId('frame-count') private accessor outside!: Query

  async outsideTexts(): Promise<string[]> {
    return this.outside.texts()
  }

  /** A frame marker on a `<p>`: there is no document to enter. */
  counterInWrongElement(): CounterHarness {
    return this.childHarness(CounterHarness, { frame: testId('frame-count') })
  }

  /** The same child, reached through `childHarness()` rather than the decorator. */
  counterByMethod(): CounterHarness {
    return this.childHarness(CounterHarness, { frame: testId('framed') })
  }
}

/** A harness whose host IS the iframe: `self` is the element, children are inside. */
@Harness({ host: frame(testId('framed')) })
export class FrameHarness extends ComponentHarness {
  @ByTestId('frame-count') private accessor total!: Query
  @ByTestId('frame-count', { global: true }) private accessor anywhere!: Query

  async title(): Promise<string | null> {
    return this.self.attribute('title')
  }

  async text(): Promise<string> {
    return this.total.text()
  }

  /** Global starts from the top document, so only the decoy is in reach. */
  async globalTexts(): Promise<string[]> {
    return this.anywhere.texts()
  }
}
