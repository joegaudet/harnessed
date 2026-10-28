<!--
  Labels, inputs, a placeholder, a submit button, a conditionally rendered error,
  and a control whose accessible name changes with its state — the Svelte copy of
  the React fixture's LoginForm, node for node.
-->
<script lang="ts">
  type LoginStatus = 'idle' | 'submitting' | 'done'

  interface Props {
    onsubmit?: (email: string, password: string) => void
    /** Renders the error line when set. Absent otherwise — exercises count()/isAbsent(). */
    error?: string | undefined
    /** Renders two same-id nodes after a delay, for the late-duplicate case. */
    lateDuplicates?: boolean
  }

  let { onsubmit, error, lateDuplicates = false }: Props = $props()

  let email = $state('')
  let password = $state('')
  let status = $state<LoginStatus>('idle')
  let late = $state(false)
  let uploads = $state('')

  const label = $derived(
    status === 'done' ? 'Signed in' : status === 'submitting' ? 'Signing in…' : 'Sign in',
  )

  // What a change listener sees in the input's own `files`: names and sizes, so
  // the contents are known to have arrived too.
  function onFiles(event: Event & { currentTarget: HTMLInputElement }) {
    uploads = [...(event.currentTarget.files ?? [])]
      .map(file => `${file.name}:${file.size}`)
      .join(', ')
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    status = 'submitting'
    onsubmit?.(email, password)
    status = 'done'
  }

  $effect(() => {
    if (!lateDuplicates) return
    const timer = setTimeout(() => (late = true), 150)
    return () => clearTimeout(timer)
  })
</script>

<form data-testid="login-form" onsubmit={submit}>
  <h1>Sign in</h1>

  <label for="login-email">Email</label>
  <input
    id="login-email"
    data-testid="login-email"
    placeholder="you@example.com"
    bind:value={email}
  />

  <label for="login-password">Password</label>
  <input id="login-password" type="password" bind:value={password} />

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

  <!-- `disabled` is inherited: this control has no disabled attribute of its own. -->
  <fieldset disabled>
    <label for="login-referral">Referral code</label>
    <input id="login-referral" data-testid="login-referral" />
  </fieldset>

  <label for="login-avatar">Avatar</label>
  <input id="login-avatar" type="file" onchange={onFiles} />

  <label for="login-attachments">Attachments</label>
  <input id="login-attachments" type="file" multiple onchange={onFiles} />

  <!-- A div, not a <p>: the late paragraph is found by role, and must stay the only one. -->
  <div data-testid="login-uploads">{uploads}</div>

  <!-- Appears after a beat, as two nodes: a strict violation that cannot be
       seen by a query that only looks once. -->
  {#if late}
    <p>
      <span data-testid="login-late">first</span>
      <span data-testid="login-late">second</span>
    </p>
  {/if}

  {#if error}
    <p data-testid="login-error">{error}</p>
  {/if}

  <button type="submit" data-testid="login-submit" data-status={status} disabled={!email}>
    {label}
  </button>
</form>
