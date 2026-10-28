# Example: Storybook (Ember)

A `LoginFormHarness` driving an Ember form's Storybook stories. Each play
function calls the harness rather than querying the canvas, the Interactions
panel shows each harness method as a step, and every interaction resolves once
Ember has settled. The same stories open as fixtures from Playwright through
`StoryPage`.

[Open in StackBlitz](https://stackblitz.com/github/joegaudet/harnessed/tree/main/examples/storybook-ember?file=src/login-form.stories.gts)

```bash
npm install
npm run storybook   # open "Forms/Login Form" and watch the Interactions panel
npm test            # every story's play function, through Storybook's Vitest addon
npm run test:e2e    # the stories opened as fixtures from Playwright
```

The build is a minimal Embroider app under `@storybook/html-vite`:
`.storybook/main.ts` adds Embroider's Vite plugins and indexes `.gts` stories,
and `.storybook/preview.ts` renders each story through Ember's
`renderComponent` (Ember 6.8 or later).

This project installs `@harnessed-ts/*` from npm, not the workspace, so it is
outside `pnpm-workspace.yaml`.
