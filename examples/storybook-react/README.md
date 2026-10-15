# Example: Storybook (React)

A `LoginFormHarness` driving a React form's Storybook stories. Each play
function calls the harness rather than querying the canvas, and the
Interactions panel shows each harness method as a step. The same stories open
as fixtures from Playwright through `StoryPage`.

[Open in StackBlitz](https://stackblitz.com/github/joegaudet/harnessed/tree/main/examples/storybook-react?file=src/LoginForm.stories.tsx)

```bash
npm install
npm run storybook   # open "Forms/Login Form" and watch the Interactions panel
npm test            # every story's play function, through Storybook's Vitest addon
npm run test:e2e    # the stories opened as fixtures from Playwright
```

This project installs `@harnessed-ts/*` from npm, not the workspace, so it is
outside `pnpm-workspace.yaml`.
