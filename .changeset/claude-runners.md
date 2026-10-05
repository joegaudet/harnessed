---
'@harnessed-ts/claude': minor
---

`install` detects the repo's test runners — Ember, Cypress, WebdriverIO, TestCafe, Puppeteer, Playwright, Vitest browser mode, Testing Library, and the Gherkin runners — from the dependencies (including peer and optional ones) and config files of the root and each workspace package, from `workspaces` or `pnpm-workspace.yaml`. The skill gains a generated "Your runners" section showing how a test in that repo builds the env and asserts, and a worked example is written per detected runner, with the Gherkin one matching the adapter in use. `--runners a,b` chooses the runners instead, and a re-run removes the examples of runners no longer in use.
