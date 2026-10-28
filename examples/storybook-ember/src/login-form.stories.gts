import type { WithHarness } from '@harnessed-ts/storybook';
import type { Meta, StoryObj } from '@harnessed-ts/storybook/ember';
import { expect } from 'storybook/test';
import LoginForm from './login-form';
import { LoginFormHarness } from './harness/login-form.harness';

const checkPassword = (_email: string, password: string) =>
  password === 'hunter2' ? null : 'Wrong password';

const meta = {
  title: 'Forms/Login Form',
  render: () => <template><LoginForm @onSubmit={{checkPassword}} /></template>,
  // The play functions below receive this as `harness`.
  parameters: { harness: LoginFormHarness },
} satisfies Meta;
export default meta;

type Story = WithHarness<StoryObj, LoginFormHarness>;

export const Empty: Story = {};

export const SignedIn: Story = {
  play: async ({ harness }) => {
    await harness.signInAs('ada@example.com', 'hunter2');
    await expect(await harness.error()).toBeNull();
  },
};

export const WrongPassword: Story = {
  play: async ({ harness }) => {
    await harness.signInAs('ada@example.com', 'guess');
    await expect(await harness.error()).toBe('Wrong password');
  },
};
