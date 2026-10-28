---
'@harnessed-ts/storybook': minor
'@harnessed-ts/dom': minor
'@harnessed-ts/eslint-plugin': minor
---

Ember stories. `@harnessed-ts/storybook/ember` renders stories as Ember components under `@storybook/html-vite`, through Ember's public `renderComponent` (Ember 6.8 or later, Storybook 10): spread `emberRenderer` and its `harnessed()` into `.storybook/preview.ts`, and a story renders its meta's `component` with the story's args, or whatever its `render` returns, `<template>` included. Its `harnessed()` resolves every harness interaction once Ember has settled (rendering, run loop, timers and `@ember/test-waiters`), as `@harnessed-ts/ember` does; `settled()` is exported too. `parameters.ember.owner` sets the owner a story renders with. `composeStories`, `composeStory` and `setProjectAnnotations` from the same entry run Ember stories as portable stories, and `Meta`, `StoryObj` and `Preview` type them. `emberIndexer` from `@harnessed-ts/storybook/ember/node` indexes `.stories.gjs` and `.stories.gts` files, whose `<template>` tags Storybook's own indexer cannot parse; it needs `content-tag`. The conformance catalog runs against Ember stories all three ways React's do: as portable stories, through `StoryPage` under Playwright, and through the Vitest addon.

`storiesModule()` from `@harnessed-ts/storybook/page` stands in for a stories module a Node runner cannot import (one that imports Ember components), typed as that module: `StoryPage.goto` only reads its meta's `title` or `id`.

`harnessed()` takes an `afterAction` option, awaited after every interaction a harness makes, and `dom()` takes the same option for any framework that renders asynchronously.

The ESLint plugin treats `.stories.gjs` and `.stories.gts` files as stories files, so `no-raw-locator-in-test` flags raw canvas queries in Ember play functions.
