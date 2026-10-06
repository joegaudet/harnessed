---
'@harnessed-ts/puppeteer': minor
---

New `@harnessed-ts/puppeteer` driver: `puppeteer(page, { baseURL })` builds the env, selectors resolve through the injected `@harnessed-ts/resolve`, actions go through Puppeteer's `ElementHandle`s, and `frame()` links are entered with `contentFrame()` — cross-origin frames included. It can navigate, and `@harnessed-ts/puppeteer/matchers` registers the matchers with Vitest.
