import { viewSearch } from '@harnessed-ts/conformance';
import type { View } from '@harnessed-ts/conformance';
import type { Meta, StoryObj } from '@harnessed-ts/storybook/ember';
import ConformanceApp from 'test-app-ember-vite/components/fixture/conformance-app';

/**
 * One story per conformance view, rendered with a `<template>`: the Glimmer
 * fixture takes the URL it routes on as an argument. The specs open these —
 * through portable stories in Vitest, and through `StoryPage` in Playwright.
 */
const meta = {
  title: 'Conformance/Views',
  render: ({ view }) => {
    const url = `/${viewSearch(view)}`;
    return <template><ConformanceApp @url={{url}} /></template>;
  },
} satisfies Meta<{ view: View }>;
export default meta;

type Story = StoryObj<{ view: View }>;

export const Login: Story = { args: { view: 'login' } };
export const LoginError: Story = { args: { view: 'login-error' } };
export const LoginLateDuplicates: Story = { args: { view: 'login-late-duplicates' } };
export const Cards: Story = { args: { view: 'cards' } };
export const Dialog: Story = { args: { view: 'dialog' } };
export const Frame: Story = { args: { view: 'frame' } };
export const Wizard: Story = { args: { view: 'wizard' } };
export const Data: Story = { args: { view: 'data' } };
