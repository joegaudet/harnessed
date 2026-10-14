import { useState } from 'react'

export function LoginForm({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => string | null
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      data-testid="login-form"
      onSubmit={e => {
        e.preventDefault()
        setError(onSubmit(email, password))
      }}
    >
      <label htmlFor="email">Email</label>
      <input id="email" value={email} onChange={e => setEmail(e.target.value)} />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      {error ? <p data-testid="login-error">{error}</p> : null}

      <button type="submit">Sign in</button>
    </form>
  )
}
