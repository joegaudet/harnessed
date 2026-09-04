import { useState } from 'react'

export type LoginStatus = 'idle' | 'submitting' | 'done'

export interface LoginFormProps {
  onSubmit?: (email: string, password: string) => void
  /** Renders the error line when set. Absent otherwise — exercises count()/isAbsent(). */
  error?: string
}

/**
 * Labels, inputs, a placeholder, a submit button, a conditionally rendered error,
 * and a control whose accessible name changes with its state (which is why the
 * status carries a data attribute instead).
 */
export function LoginForm({ onSubmit, error }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<LoginStatus>('idle')

  return (
    <form
      data-testid="login-form"
      onSubmit={e => {
        e.preventDefault()
        setStatus('submitting')
        onSubmit?.(email, password)
        setStatus('done')
      }}
    >
      <h1>Sign in</h1>

      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        data-testid="login-email"
        placeholder="you@example.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <label htmlFor="login-remember">Remember me</label>
      <input id="login-remember" type="checkbox" />

      <label htmlFor="login-plan">Plan</label>
      <select id="login-plan" defaultValue="free">
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>

      {error ? <p data-testid="login-error">{error}</p> : null}

      <button type="submit" data-testid="login-submit" data-status={status} disabled={!email}>
        {status === 'done' ? 'Signed in' : status === 'submitting' ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
