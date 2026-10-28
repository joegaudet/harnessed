import { Component, input, output, signal } from '@angular/core'

export interface CardSpec {
  label: string
  hint?: string
}

/** The host IS the interactive element — exercises `self`. Selection is aria-pressed. */
@Component({
  selector: 'button[fixtureCard]',
  host: {
    type: 'button',
    'data-testid': 'card',
    'data-test-card': '',
    '[attr.aria-pressed]': 'on()',
    '(click)': 'choose.emit()',
  },
  template: `
    <!-- A presence attribute may carry a value; it still matches by name alone. -->
    <span data-testid="card-label" [attr.data-test-card-label]="label()">{{ label() }}</span>
    @if (hint()) {
      <small data-testid="card-hint" data-test-card-hint="">{{ hint() }}</small>
    }
  `,
})
export class Card {
  readonly label = input.required<string>()
  readonly hint = input<string | undefined>()
  readonly on = input(false)
  readonly choose = output()
}

/** Several instances of one component on one screen — exercises count/nth/map/filter. */
@Component({
  selector: 'div[fixtureCardGrid]',
  imports: [Card],
  host: { 'data-testid': 'card-grid', 'data-test-card-grid': '' },
  template: `
    <h1>Options</h1>
    <h2>Pick one</h2>
    <!-- The track key changes when selection does, so choosing REPLACES the DOM
         node rather than mutating it — deliberately, because a resolved-once list
         that keeps reading a detached node reads stale values silently. -->
    @for (card of cards(); track card.label + ':' + (chosen() === card.label)) {
      <button
        fixtureCard
        [label]="card.label"
        [hint]="card.hint"
        [on]="chosen() === card.label"
        (choose)="chosen.set(card.label)"
      ></button>
    }
  `,
})
export class CardGrid {
  readonly cards = input.required<CardSpec[]>()
  protected readonly chosen = signal<string | null>(null)
}
