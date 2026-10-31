# @harnessed-ts/nightwatch

## 0.8.0

### Patch Changes

- Updated dependencies [d00bf4e]
  - @harnessed-ts/core@0.8.0
  - @harnessed-ts/resolve@0.8.0

## 0.7.0

### Minor Changes

- ec06bdf: Vue, Solid, Svelte and Angular join React and Ember as conformance-tested UI frameworks, and node:test, Bun and Nightwatch join the runners.

  New packages: `@harnessed-ts/nightwatch` drives Nightwatch 3 through the injected resolver, under Nightwatch's own runner and its Mocha runner, in end-to-end and component tests (`@nightwatch/react`, `@nightwatch/vue`), with cross-origin frames. `@harnessed-ts/angular` drives zoneless Angular 21+: every action settles at `fixture.whenStable()`, or at the `ApplicationRef`'s for an app bootstrapped without TestBed, and `goto()` drives a provided router.

  `@harnessed-ts/core/register` loads TypeScript harnesses under `node --import`: esbuild strips the types, lowers standard decorators and `accessor`, and compiles JSX. `@harnessed-ts/core/bun` does the same as a `bun test` preload, so harnesses keep the standard decorator protocol whatever `experimentalDecorators` the tsconfig sets.

  `@harnessed-ts/dom/matchers/bun` registers the matchers with `bun:test`. The dom driver runs on happy-dom too: it focuses the frames leading to an interaction's target, finds a frame's `<iframe>` where `frameElement` is unset, and reads a select's selection off `options`.

  `@harnessed-ts/resolve/webdriver` holds the WebDriver half of injected resolution, shared by the WebdriverIO and Nightwatch drivers. `@harnessed-ts/gherkin/nightwatch` adapts the cucumber-js world to Nightwatch's Cucumber runner.

  `@harnessed-ts/playwright`, and `@harnessed-ts/cypress` under `realEvents`, give the page a task after every action, so a read straight after it sees what a framework that renders on a timer (zoneless Angular) has rendered. The injectable resolver installs on the page's `window` rather than the script's global, which under Firefox's WebDriver is a sandbox in front of it.

  `@harnessed-ts/conformance` exports `fixtureParity()`, the per-view parity check a port of the fixture to another framework runs, naming the first place its markup parts from the React original; it detects a simulated DOM from the DOM's own window.

  `@harnessed-ts/eslint-plugin` recognises Nightwatch's, Angular's and Vue Test Utils' raw queries, and looks in `nightwatch/` by default. `npx @harnessed-ts/claude install` detects Angular, Nightwatch, node:test and Bun.

### Patch Changes

- Updated dependencies [ec06bdf]
  - @harnessed-ts/core@0.7.0
  - @harnessed-ts/resolve@0.7.0
