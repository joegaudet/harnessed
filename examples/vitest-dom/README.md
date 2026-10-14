# Example: Testing Library + Vitest (jsdom)

A `LoginFormHarness` driving a React form in jsdom. The same harness class runs
unchanged under Playwright, Cypress, WebdriverIO and the other runners.

[Open in StackBlitz](https://stackblitz.com/github/joegaudet/harnessed/tree/main/examples/vitest-dom?file=src/LoginForm.test.tsx)

```bash
npm install
npm test
```

This project installs `@harnessed-ts/*` from npm, not the workspace, so it is
outside `pnpm-workspace.yaml`.
