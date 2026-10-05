import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import type { TOC } from '@ember/component/template-only';

export interface CardSpec {
  label: string;
  hint?: string;
}

interface CardSignature {
  Args: { label: string; hint?: string; on: boolean; onChoose: () => void };
}

/** The host IS the interactive element — exercises `self`. Selection is aria-pressed. */
const Card = <template>
  <button
    type="button"
    data-testid="card"
    aria-pressed={{if @on "true" "false"}}
    {{on "click" @onChoose}}
  >
    <span data-testid="card-label">{{@label}}</span>
    {{#if @hint}}<small data-testid="card-hint">{{@hint}}</small>{{/if}}
  </button>
</template> satisfies TOC<CardSignature>;

interface CardGridSignature {
  Args: { cards: CardSpec[] };
}

/** Several instances of one component on one screen — exercises count/nth/map/filter. */
export default class CardGrid extends Component<CardGridSignature> {
  @tracked chosen: string | null = null;

  /**
   * The key changes when selection does, so choosing REPLACES the DOM node
   * rather than mutating it — deliberately, as in the React fixture: a
   * resolved-once list that keeps reading a detached node reads stale values.
   */
  get items() {
    return this.args.cards.map((card) => ({
      ...card,
      key: `${card.label}:${this.chosen === card.label}`,
      on: this.chosen === card.label,
    }));
  }

  choose = (label: string) => {
    this.chosen = label;
  };

  <template>
    <div data-testid="card-grid">
      <h1>Options</h1>
      <h2>Pick one</h2>
      {{#each this.items key="key" as |card|}}
        <Card
          @label={{card.label}}
          @hint={{card.hint}}
          @on={{card.on}}
          @onChoose={{fn this.choose card.label}}
        />
      {{/each}}
    </div>
  </template>
}
