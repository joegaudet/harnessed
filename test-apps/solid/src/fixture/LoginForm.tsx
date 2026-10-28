import { createSignal, onCleanup, onMount, Show } from 'solid-js'

export type LoginStatus = 'idle' | 'submitting' | 'done'

export interface LoginFormProps {
  onSubmit?: (email: string, password: string) => void
  /** Renders the error line when set. Absent otherwise — exercises count()/isAbsent(). */
  error?: string | undefined
  /** Renders two same-id nodes after a delay, for the late-duplicate case. */
  lateDuplicates?: boolean
}

/**
 * Labels, inputs, a placeholder, a submit button, a conditionally rendered error,
 * and a control whose accessible name changes with its state — the Solid copy of
 * the React fixture's LoginForm, node for node.
 */
export function LoginForm(props: LoginFormProps) {
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [status, setStatus] = createSignal<LoginStatus>('idle')
  const [late, setLate] = createSignal(false)
  const [uploads, setUploads] = createSignal('')

  // What a change listener sees in the input's own `files`: names and sizes, so
  // the contents are known to have arrived too.
  const onFiles = (event: Event & { currentTarget: HTMLInputElement }) =>
    setUploads(
      [...(event.currentTarget.files ?? [])].map(file => `${file.name}:${file.size}`).join(', '),
    )

  onMount(() => {
    if (!props.lateDuplicates) return
    const timer = setTimeout(() => setLate(true), 150)
    onCleanup(() => clearTimeout(timer))
  })

  const label = () =>
    status() === 'done' ? 'Signed in' : status() === 'submitting' ? 'Signing in…' : 'Sign in'

  return (
    <form
      data-testid="login-form"
      onSubmit={e => {
        e.preventDefault()
        setStatus('submitting')
        props.onSubmit?.(email(), password())
        setStatus('done')
      }}
    >
      <h1>Sign in</h1>

      <label for="login-email">Email</label>
      <input
        id="login-email"
        data-testid="login-email"
        placeholder="you@example.com"
        value={email()}
        onInput={e => setEmail(e.currentTarget.value)}
      />

      <label for="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        value={password()}
        onInput={e => setPassword(e.currentTarget.value)}
      />

      <label for="login-remember">Remember me</label>
      <input id="login-remember" type="checkbox" />

      <label for="login-plan">Plan</label>
      <select id="login-plan">
        <option value="free" selected>
          Free
        </option>
        <option value="pro">Pro</option>
      </select>

      <label for="login-addons">Add-ons</label>
      <select id="login-addons" multiple>
        <option value="sms" selected>
          SMS
        </option>
        <option value="voice">Voice</option>
        <option value="fax">Fax</option>
      </select>

      {/* `disabled` is inherited: this control has no disabled attribute of its own. */}
      <fieldset disabled>
        <label for="login-referral">Referral code</label>
        <input id="login-referral" data-testid="login-referral" />
      </fieldset>

      <label for="login-avatar">Avatar</label>
      <input id="login-avatar" type="file" onChange={onFiles} />

      <label for="login-attachments">Attachments</label>
      <input id="login-attachments" type="file" multiple onChange={onFiles} />

      {/* A div, not a <p>: the late paragraph is found by role, and must stay the only one. */}
      <div data-testid="login-uploads">{uploads()}</div>

      {/* Appears after a beat, as two nodes: a strict violation that cannot be
          seen by a query that only looks once. */}
      <Show when={late()}>
        <p>
          <span data-testid="login-late">first</span>
          <span data-testid="login-late">second</span>
        </p>
      </Show>

      <Show when={props.error}>
        <p data-testid="login-error">{props.error}</p>
      </Show>

      <button type="submit" data-testid="login-submit" data-status={status()} disabled={!email()}>
        {label()}
      </button>
    </form>
  )
}
