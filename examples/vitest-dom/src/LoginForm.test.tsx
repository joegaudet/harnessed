import { dom } from '@harnessed-ts/dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { LoginForm } from './LoginForm'
import { LoginFormHarness } from './LoginForm.harness'

const checkPassword = (_email: string, password: string) =>
  password === 'hunter2' ? null : 'Wrong password'

function setup() {
  render(<LoginForm onSubmit={checkPassword} />)
  return new LoginFormHarness(dom({ user: userEvent.setup() }))
}

test('signs in with the right password', async () => {
  const form = setup()
  await form.signInAs('ada@example.com', 'hunter2')
  expect(await form.error()).toBeNull()
})

test('shows an error for the wrong password', async () => {
  const form = setup()
  await form.signInAs('ada@example.com', 'guess')
  expect(await form.error()).toBe('Wrong password')
})
