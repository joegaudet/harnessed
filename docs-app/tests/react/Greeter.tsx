import { useState } from 'react'

/** The React twin of the Ember greeter in tests/integration/harness-in-ember-test.gts. */
export function Greeter() {
  const [name, setName] = useState('')
  return (
    <div data-testid="greeter">
      <label>
        Name <input value={name} onChange={e => setName(e.target.value)} />
        <output data-testid="greeting">{name && `Hi ${name}`}</output>
      </label>
    </div>
  )
}
