import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import CardGrid, { type CardSpec } from './card-grid';
import FramedPanel from './framed-panel';
import LoginForm from './login-form';
import PortalDialog from './portal-dialog';
import { StepOne, StepTwo } from './wizard';

export const CARDS: CardSpec[] = [
  { label: 'Small', hint: 'Under 1000 sq ft' },
  { label: 'Medium', hint: '1000 to 2500 sq ft' },
  { label: 'Large' },
];

interface Signature {
  /** The path and query, e.g. `/step-two?token=abc` — the router's URL in an application test. */
  Args: { url: string };
}

/**
 * The Glimmer port of the conformance fixture's App: `?view=` picks the
 * component under test and the pathname picks the wizard step. It must render
 * the same tree as the React original — the fixture-parity test holds it to that.
 */
export default class ConformanceApp extends Component<Signature> {
  @tracked step: 'one' | 'two' = 'one';
  cards = CARDS;

  get url() {
    return new URL(this.args.url, 'http://fixture.invalid');
  }

  get view() {
    return this.url.searchParams.get('view') ?? 'wizard';
  }

  get is() {
    const view = this.view;
    return {
      login: view === 'login',
      cards: view === 'cards',
      dialog: view === 'dialog',
      frame: view === 'frame',
      wizard: view === 'wizard',
    };
  }

  get error() {
    return this.url.searchParams.get('error') ?? undefined;
  }

  get lateDuplicates() {
    return this.url.searchParams.get('late') === '1';
  }

  get onStepTwoPath() {
    return this.url.pathname === '/step-two';
  }

  get token() {
    return this.url.searchParams.get('token');
  }

  next = () => {
    this.step = 'two';
  };

  <template>
    <div data-testid="stage">
      {{#if this.is.login}}
        <section data-testid="page-login">
          <LoginForm @error={{this.error}} @lateDuplicates={{this.lateDuplicates}} />
        </section>
      {{/if}}
      {{#if this.is.cards}}
        <section data-testid="page-cards">
          <CardGrid @cards={{this.cards}} />
          {{! Same test id, outside the grid: a scope-dropping query finds this. }}
          <span data-testid="card-hint">decoy outside the grid</span>
        </section>
      {{/if}}
      {{#if this.is.dialog}}
        <section data-testid="page-dialog">
          <PortalDialog />
        </section>
      {{/if}}
      {{#if this.is.frame}}
        <section data-testid="page-frame">
          <FramedPanel />
        </section>
      {{/if}}
      {{#if this.is.wizard}}
        <section data-testid="page-wizard">
          {{#if this.onStepTwoPath}}
            <StepTwo @token={{this.token}} />
          {{else if (eq this.step "two")}}
            <StepTwo @token="in-page" />
          {{else}}
            <StepOne @onNext={{this.next}} />
          {{/if}}
        </section>
      {{/if}}
    </div>
  </template>
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}
