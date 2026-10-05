import { harnessedChai } from '@harnessed-ts/chai'
import { chai } from 'vitest'

// The config as JSON text: browser mode injects a `define` value as the literal
// string it was given, not as an expression to evaluate.
declare const __APP_CONFIG__: string

// What Embroider's index.html transform would have written: the app reads its
// config from this tag when its config module loads.
const meta = document.createElement('meta')
meta.name = 'test-app-ember-vite/config/environment'
meta.content = encodeURIComponent(__APP_CONFIG__)
document.head.append(meta)

// Vitest's `expect` is Chai: the BDD assertions an ember-mocha suite would use.
chai.use(harnessedChai)
