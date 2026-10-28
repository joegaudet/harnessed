import { Component, DestroyRef, inject, input, signal } from '@angular/core'
import type { OnInit } from '@angular/core'

export type LoginStatus = 'idle' | 'submitting' | 'done'

/**
 * Labels, inputs, a placeholder, a submit button, a conditionally rendered error,
 * and a control whose accessible name changes with its state — the Angular copy
 * of the React fixture's LoginForm, node for node.
 *
 * An attribute selector, so the host IS the `<form>`: an element selector would
 * put a `<fixture-login-form>` around it that the React fixture does not render.
 */
@Component({
  selector: 'form[fixtureLoginForm]',
  host: { 'data-testid': 'login-form', '(submit)': 'submit($event)' },
  template: `
    <h1>Sign in</h1>

    <label for="login-email">Email</label>
    <input
      id="login-email"
      data-testid="login-email"
      placeholder="you@example.com"
      [value]="email()"
      (input)="email.set(valueOf($event))"
    />

    <label for="login-password">Password</label>
    <input
      id="login-password"
      type="password"
      [value]="password()"
      (input)="password.set(valueOf($event))"
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

    <!-- disabled is inherited: this control has no disabled attribute of its own. -->
    <fieldset disabled>
      <label for="login-referral">Referral code</label>
      <input id="login-referral" data-testid="login-referral" />
    </fieldset>

    <label for="login-avatar">Avatar</label>
    <input id="login-avatar" type="file" (change)="onFiles($event)" />

    <label for="login-attachments">Attachments</label>
    <input id="login-attachments" type="file" multiple (change)="onFiles($event)" />

    <!-- A div, not a <p>: the late paragraph is found by role, and must stay the only one. -->
    <div data-testid="login-uploads">{{ uploads() }}</div>

    @if (late()) {
      <p>
        <span data-testid="login-late">first</span>
        <span data-testid="login-late">second</span>
      </p>
    }

    @if (error()) {
      <p data-testid="login-error">{{ error() }}</p>
    }

    <button
      type="submit"
      data-testid="login-submit"
      [attr.data-status]="status()"
      [disabled]="!email()"
    >
      {{ label() }}
    </button>
  `,
})
export class LoginForm implements OnInit {
  /** Renders the error line when set. Absent otherwise — exercises count()/isAbsent(). */
  readonly error = input<string | undefined>()
  /** Renders two same-id nodes after a delay, for the late-duplicate case. */
  readonly lateDuplicates = input(false)

  protected readonly email = signal('')
  protected readonly password = signal('')
  protected readonly status = signal<LoginStatus>('idle')
  protected readonly late = signal(false)
  protected readonly uploads = signal('')

  private readonly destroyRef = inject(DestroyRef)

  ngOnInit(): void {
    if (!this.lateDuplicates()) return
    // A plain timer, which a zoneless app does not track: whenStable() must not
    // wait for it, since the duplicates have to arrive after the view is on screen.
    const timer = setTimeout(() => this.late.set(true), 150)
    this.destroyRef.onDestroy(() => clearTimeout(timer))
  }

  protected label(): string {
    const status = this.status()
    return status === 'done' ? 'Signed in' : status === 'submitting' ? 'Signing in…' : 'Sign in'
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value
  }

  // What a change listener sees in the input's own `files`: names and sizes, so
  // the contents are known to have arrived too.
  protected onFiles(event: Event): void {
    const files = (event.currentTarget as HTMLInputElement).files ?? []
    this.uploads.set([...files].map(file => `${file.name}:${file.size}`).join(', '))
  }

  protected submit(event: Event): void {
    event.preventDefault()
    this.status.set('submitting')
    this.status.set('done')
  }
}
