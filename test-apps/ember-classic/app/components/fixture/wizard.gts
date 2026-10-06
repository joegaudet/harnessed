import type { TOC } from '@ember/component/template-only';
import { on } from '@ember/modifier';

export const StepOne = <template>
  <section data-testid="page-step-one">
    <h1>Step one</h1>
    <button type="button" {{on "click" @onNext}}>Continue</button>
  </section>
</template> satisfies TOC<{ Args: { onNext: () => void } }>;

function isExpired(token: string | null): boolean {
  return token === null || token === 'expired';
}

export const StepTwo = <template>
  <section data-testid="page-step-two">
    <h1>Step two</h1>
    {{#if (isExpired @token)}}
      <p data-testid="step-two-expired">That link has expired</p>
    {{else}}
      <p data-testid="step-two-token">{{@token}}</p>
    {{/if}}
  </section>
</template> satisfies TOC<{ Args: { token: string | null } }>;
