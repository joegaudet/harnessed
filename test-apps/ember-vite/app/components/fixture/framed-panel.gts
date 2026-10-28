import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { next } from '@ember/runloop';
import { modifier } from 'ember-modifier';

/**
 * Layout the boundingBox specs measure, as in the React fixture. The frame's
 * border and padding sit between its box and its document.
 */
const FRAME = 'width: 240px; height: 120px; border: 3px solid; padding: 4px';
const MARKER = 'position: fixed; left: 12px; top: 34px; width: 56px; height: 78px; pointer-events: none';
const FRAMED_MARKER =
  'position: fixed; left: 5px; top: 6px; width: 20px; height: 10px; pointer-events: none';

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

  get frameStyle() {
    return this.hidden ? `${FRAME}; display: none` : FRAME;
  }

  hide = () => {
    this.hidden = true;
  };

  add = () => {
    this.count += 1;
  };

  <template>
    <div data-testid="frame-host" data-test-frame-host>
      <p data-testid="frame-count" data-test-frame-count>decoy outside the frame</p>
      <p data-testid="frame-toast" data-test-frame-toast>decoy toast outside the frame</p>
      {{! Fixed, so its box is known in the viewport; it takes no clicks. }}
      <div data-testid="box" style={{MARKER}}></div>
      <button type="button" {{on "click" this.hide}}>Hide frame</button>
      <iframe
        data-testid="framed"
        data-test-framed
        title="Framed counter"
        style={{this.frameStyle}}
        {{this.frame}}
        {{on "load" this.loaded}}
      ></iframe>
      {{#if this.body}}
        {{#in-element this.body insertBefore=null}}
          <div data-testid="counter" data-test-counter>
            <p data-testid="frame-count" data-test-frame-count>Clicked {{this.count}} times</p>
            <button type="button" {{on "click" this.add}}>Add one</button>
            <label>Note <input /></label>
          </div>
          <p data-testid="frame-toast" data-test-frame-toast>Toast inside the frame</p>
          <div data-testid="framed-box" style={{FRAMED_MARKER}}></div>
        {{/in-element}}
      {{/if}}
    </div>
  </template>
}
