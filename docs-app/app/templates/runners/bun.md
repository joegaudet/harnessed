# Bun

```bash
bun add -d @harnessed-ts/core @harnessed-ts/dom esbuild \
  @testing-library/dom @testing-library/user-event @happy-dom/global-registrator
```

`bun test` on happy-dom, Bun's documented DOM. Preload the DOM, the decorator
loader and the matchers, in that order:

```toml
# bunfig.toml
[test]
preload = ["./happydom.ts", "@harnessed-ts/core/bun", "@harnessed-ts/dom/matchers/bun", "./cleanup.ts"]
```

```ts
// happydom.ts
import { GlobalRegistrator } from '@happy-dom/global-registrator'
// happy-dom loads no frame documents unless asked, not even about:blank.
GlobalRegistrator.register({
  url: 'http://localhost/',
  settings: { enableIframePageLoading: true },
})

// cleanup.ts — bun:test has no global afterEach for Testing Library to find
import { cleanup } from '@testing-library/react'
import { afterEach } from 'bun:test'
afterEach(cleanup)
```

Tests then read like the Vitest ones, with `expect` from `bun:test`:
`await expect(form.errorBanner).toBeAbsent()`. Add
`import '@harnessed-ts/dom/matchers/bun'` to a `.d.ts` your tsconfig includes, so
the test files see the matchers' types.

Bun compiles standard decorators itself, but follows `experimentalDecorators`
in the nearest tsconfig — which an Angular or MobX project sets for its own code.
`@harnessed-ts/core/bun` lowers every TypeScript file that uses decorators with
esbuild first, so harnesses keep the standard protocol whatever the tsconfig
says. happy-dom computes no layout, so `isVisible()` and `boundingBox()` behave as
under jsdom. Bun 1.2 or later.
