import { harnessedChai } from '@harnessed-ts/chai'
import { chai } from 'vitest'

// The config, from vitest.config.mts. Browser mode injects a `define` value as
// the literal string it was given; Vite proper would evaluate it to an object.
declare const __APP_CONFIG__: string | Record<string, unknown>

// What Embroider's index.html transform would have written: the app reads its
// config from this tag when its config module loads.
const meta = document.createElement('meta')
meta.name = 'test-app-ember-vite/config/environment'
meta.content = encodeURIComponent(
  typeof __APP_CONFIG__ === 'string' ? __APP_CONFIG__ : JSON.stringify(__APP_CONFIG__),
)
document.head.append(meta)

// Vitest's `expect` is Chai: BDD assertions, in the style of a Mocha suite.
chai.use(harnessedChai)
