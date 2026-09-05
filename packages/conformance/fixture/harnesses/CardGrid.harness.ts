import {
  ByRole,
  ByTestId,
  ChildHarness,
  ComponentHarness,
  Harness,
  testId,
} from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'

/** The host is itself the button, so `choose()` acts on `self`. */
@Harness({ host: testId('card') })
export class CardHarness extends ComponentHarness {
  @ByTestId('card-label') private accessor labelLine!: Query
  @ByTestId('card-hint') private accessor hintLine!: Query

  async label(): Promise<string> {
    return this.labelLine.text()
  }

  async hint(): Promise<string | null> {
    if (await this.hintLine.isAbsent()) return null
    return this.hintLine.text()
  }

  async isChosen(): Promise<boolean> {
    return (await this.self.attribute('aria-pressed')) === 'true'
  }

  async choose(): Promise<void> {
    await this.self.click()
  }
}

@Harness({ host: testId('card-grid') })
export class CardGridHarness extends ComponentHarness {
  @ByRole('heading', { level: 1 }) private accessor topTitle!: Query
  @ByRole('heading', { level: 2 }) private accessor title!: Query
  @ChildHarness(CardHarness) private accessor card!: CardHarness

  /** There is an h1 AND an h2 here, so `level` has to do real work. */
  async topHeading(): Promise<string> {
    return this.topTitle.text()
  }

  async heading(): Promise<string> {
    return this.title.text()
  }

  async cardCount(): Promise<number> {
    return this.card.count()
  }

  async labels(): Promise<string[]> {
    return this.card.map(c => c.label())
  }

  /**
   * Each card's own hint. 'Large' has none, and a decoy with the same test id sits
   * outside the grid — so this is only correct if each child harness reads its own
   * subtree rather than the page.
   */
  async hints(): Promise<(string | null)[]> {
    return this.card.map(c => c.hint())
  }

  async chooseByLabel(label: string): Promise<void> {
    const matches = await this.card.filter(async c => (await c.label()) === label)
    if (matches.length !== 1) {
      throw new Error(`expected exactly one card labelled ${label}, found ${matches.length}`)
    }
    await matches[0]!.choose()
  }

  async chosenLabel(): Promise<string | null> {
    const chosen = await this.card.filter(c => c.isChosen())
    return chosen.length === 0 ? null : chosen[0]!.label()
  }

  async labelAt(index: number): Promise<string> {
    return this.card.nth(index).label()
  }

  async firstLabel(): Promise<string> {
    return this.card.first().label()
  }

  async lastLabel(): Promise<string> {
    return (await this.card.last()).label()
  }

  async visitedLabels(): Promise<string[]> {
    const seen: string[] = []
    await this.card.each(async c => {
      seen.push(await c.label())
    })
    return seen
  }

  /**
   * Chooses every card in order, reading each label AFTER its click — so the page
   * has re-rendered between the interaction and the read. Exists to prove list
   * iteration survives mutation; a test suite would never be this contrived.
   */
  async chooseEachInTurn(seen: string[]): Promise<void> {
    await this.card.each(async c => {
      await c.choose()
      seen.push(await c.label())
    })
  }

  /**
   * Same walk as chooseEachInTurn but through a raw Query list, where a dom
   * driver resolves all the nodes up front. Clicking re-keys the card, so the
   * resolved node is detached before the read — and a detached node still answers
   * getAttribute, with the OLD value. Only re-resolution reads the truth.
   */
  async pressedStatesAfterChoosingEach(): Promise<(string | null)[]> {
    const states: (string | null)[] = []
    await this.elementBy(testId('card')).each(async card => {
      await card.click()
      states.push(await card.attribute('aria-pressed'))
    })
    return states
  }

  /** A selector computed at call time keeps the harness scope via elementBy. */
  async labelTextAt(index: number): Promise<string> {
    return this.elementBy({ type: 'testId', testId: 'card-label', nth: index }).text()
  }

  /** One card by position, resolved lazily — for matchers that take a harness. */
  cardAt(index: number): CardHarness {
    return this.card.nth(index)
  }

  async hintCount(): Promise<number> {
    return this.elementBy(testId('card-hint')).count()
  }

  /**
   * Three cards match, and this asks a single-target question. Strict resolution
   * must reject rather than silently pick the first.
   */
  async ambiguousCardText(): Promise<string> {
    return this.elementBy(testId('card')).text()
  }
}
