import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { next } from '@ember/runloop';
import { modifier } from 'ember-modifier';

/**
 * A counter rendered INSIDE a same-origin iframe (no `src`), beside a decoy with
 * the same test id outside it.
 */
export default class FramedPanel extends Component {
  @tracked body: HTMLElement | null = null;
  @tracked count = 0;
  @tracked hidden = false;

  /**
   * The iframe's body becomes known only once it is in the DOM. Set on the next
   * runloop turn — setting tracked state mid-render is an error — which settled()
   * also waits for, so a test sees the framed content once render resolves.
   */
  frame = modifier((element: HTMLIFrameElement) => {
    next(() => (this.body = element.contentDocument?.body ?? null));
  });

  // Some engines replace the initial about:blank document when it loads.
  loaded = (event: Event) => {
    this.body = (event.currentTarget as HTMLIFrameElement).contentDocument?.body ?? null;
  };

  hide = () => {
    this.hidden = true;
  };

  add = () => {
    this.count += 1;
  };

  <template>
    <div data-testid="frame-host">
      <p data-testid="frame-count">decoy outside the frame</p>
      <p data-testid="frame-toast">decoy toast outside the frame</p>
      <button type="button" {{on "click" this.hide}}>Hide frame</button>
      <iframe
        data-testid="framed"
        title="Framed counter"
        style={{if this.hidden "display: none"}}
        {{this.frame}}
        {{on "load" this.loaded}}
      ></iframe>
      {{#if this.body}}
        {{#in-element this.body insertBefore=null}}
          <div data-testid="counter">
            <p data-testid="frame-count">Clicked {{this.count}} times</p>
            <button type="button" {{on "click" this.add}}>Add one</button>
            <label>Note <input /></label>
          </div>
          <p data-testid="frame-toast">Toast inside the frame</p>
        {{/in-element}}
      {{/if}}
    </div>
  </template>
}
