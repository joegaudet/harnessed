import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { registerDestructor } from '@ember/destroyable';
import type Owner from '@ember/owner';

type LoginStatus = 'idle' | 'submitting' | 'done';

interface LoginFormSignature {
  Args: {
    /** Renders the error line when set. Absent otherwise — exercises count()/isAbsent(). */
    error?: string;
    /** Renders two same-id nodes after a delay, for the late-duplicate case. */
    lateDuplicates?: boolean;
  };
}

/**
 * Labels, inputs, a placeholder, a submit button, a conditionally rendered error,
 * and a control whose accessible name changes with its state — the Glimmer copy
 * of the React fixture's LoginForm, node for node.
 */
export default class LoginForm extends Component<LoginFormSignature> {
  @tracked email = '';
  @tracked password = '';
  @tracked status: LoginStatus = 'idle';
  @tracked late = false;

  constructor(owner: Owner, args: LoginFormSignature['Args']) {
    super(owner, args);
    if (!args.lateDuplicates) return;
    // A plain timer, not the runloop's `later`: settled() would wait for that,
    // and the duplicates must arrive after the view is already on screen.
    const timer = setTimeout(() => (this.late = true), 150);
    registerDestructor(this, () => clearTimeout(timer));
  }

  get label() {
    return this.status === 'done'
      ? 'Signed in'
      : this.status === 'submitting'
        ? 'Signing in…'
        : 'Sign in';
  }

  updateEmail = (event: Event) => {
    this.email = (event.target as HTMLInputElement).value;
  };

  updatePassword = (event: Event) => {
    this.password = (event.target as HTMLInputElement).value;
  };

  submit = (event: Event) => {
    event.preventDefault();
    this.status = 'submitting';
    this.status = 'done';
  };

  <template>
    <form data-testid="login-form" {{on "submit" this.submit}}>
      <h1>Sign in</h1>

      <label for="login-email">Email</label>
      <input
        id="login-email"
        data-testid="login-email"
        placeholder="you@example.com"
        value={{this.email}}
        {{on "input" this.updateEmail}}
      />

      <label for="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        value={{this.password}}
        {{on "input" this.updatePassword}}
      />

      <label for="login-remember">Remember me</label>
      <input id="login-remember" type="checkbox" />

      <label for="login-plan">Plan</label>
      <select id="login-plan">
        <option value="free" selected>Free</option>
        <option value="pro">Pro</option>
      </select>

      <label for="login-addons">Add-ons</label>
      <select id="login-addons" multiple>
        <option value="sms" selected>SMS</option>
        <option value="voice">Voice</option>
        <option value="fax">Fax</option>
      </select>

      {{! `disabled` is inherited: this control has no disabled attribute of its own. }}
      <fieldset disabled>
        <label for="login-referral">Referral code</label>
        <input id="login-referral" data-testid="login-referral" />
      </fieldset>

      {{#if this.late}}
        <p>
          <span data-testid="login-late">first</span>
          <span data-testid="login-late">second</span>
        </p>
      {{/if}}

      {{#if @error}}<p data-testid="login-error">{{@error}}</p>{{/if}}

      <button
        type="submit"
        data-testid="login-submit"
        data-status={{this.status}}
        disabled={{if this.email false true}}
      >{{this.label}}</button>
    </form>
  </template>
}
