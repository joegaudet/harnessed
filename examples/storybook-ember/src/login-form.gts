import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

interface Signature {
  Args: { onSubmit: (email: string, password: string) => string | null };
}

export default class LoginForm extends Component<Signature> {
  @tracked email = '';
  @tracked password = '';
  @tracked error: string | null = null;

  updateEmail = (event: Event) => {
    this.email = (event.target as HTMLInputElement).value;
  };

  updatePassword = (event: Event) => {
    this.password = (event.target as HTMLInputElement).value;
  };

  submit = (event: SubmitEvent) => {
    event.preventDefault();
    this.error = this.args.onSubmit(this.email, this.password);
  };

  <template>
    <form data-testid="login-form" {{on "submit" this.submit}}>
      <label for="email">Email</label>
      <input id="email" value={{this.email}} {{on "input" this.updateEmail}} />

      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        value={{this.password}}
        {{on "input" this.updatePassword}}
      />

      {{#if this.error}}
        <p data-testid="login-error">{{this.error}}</p>
      {{/if}}

      <button type="submit">Sign in</button>
    </form>
  </template>
}
