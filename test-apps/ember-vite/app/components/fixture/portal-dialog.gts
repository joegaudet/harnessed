import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { getOwner } from '@ember/owner';

/**
 * Where the dialog goes: outside the host subtree, as the React fixture's
 * portal to `document.body` is — into the app's root element, the edge of what
 * an Ember app renders and where the driver's queries start. Under ember-qunit
 * that is `#ember-testing`; under Vitest, the element the test booted into.
 */
function portalTarget(owner: unknown): Element {
  const root = (owner as { rootElement?: string | Element } | undefined)?.rootElement;
  if (typeof root === 'string') return document.querySelector(root) ?? document.body;
  return root ?? document.body;
}

/** The dialog renders OUTSIDE the host subtree, so a scoped query cannot reach it. */
export default class PortalDialog extends Component {
  @tracked open = false;
  target = portalTarget(getOwner(this));

  show = () => {
    this.open = true;
  };

  dismiss = () => {
    this.open = false;
  };

  <template>
    <div data-testid="portal-host">
      <button type="button" {{on "click" this.show}}>Open confirm</button>
      {{#if this.open}}
        {{#in-element this.target insertBefore=null}}
          <div role="dialog" aria-label="Confirm">
            <p data-testid="dialog-body">Are you sure?</p>
            <button type="button" {{on "click" this.dismiss}}>Dismiss</button>
          </div>
        {{/in-element}}
      {{/if}}
    </div>
  </template>
}
