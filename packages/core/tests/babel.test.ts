import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transformSync } from '@babel/core'
import type { PluginItem } from '@babel/core'
import { describe, expect, it } from 'vitest'

/**
 * An Ember app compiles its own decorators — `@tracked`, `@service`, `@action`
 * — with the legacy transform, and cannot switch: those decorators only
 * implement the legacy protocol. A harness needs the standard (2023-11) one and
 * `accessor`. These compile both kinds of file through one Babel pipeline set up
 * the way each Ember build sets it up, then run the output and check each file
 * got the semantics it was written for.
 *
 * The plugin is loaded the way the README says to load it — the built CJS file,
 * through `require` — so `pnpm build` must run first.
 */
const require = createRequire(import.meta.url)
const HARNESSED = require.resolve('../dist/babel.cjs')
const ROOT = '/app'

const LEGACY_PIPELINES: Record<string, PluginItem[]> = {
  // ember-cli-babel (classic builds): the proposal plugin in legacy mode.
  'ember-cli-babel (legacy proposal)': [
    [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
    [require.resolve('@babel/plugin-transform-class-properties'), { loose: true }],
  ],
  // The Ember 6+ / Embroider blueprint: ef4's decorator-transforms.
  'decorator-transforms (Embroider + Vite)': [
    [
      require.resolve('decorator-transforms'),
      { runtime: { import: 'decorator-transforms/runtime' } },
    ],
  ],
}
const CLASSIC = LEGACY_PIPELINES['ember-cli-babel (legacy proposal)']!

interface CompileOptions {
  pipeline?: PluginItem[]
  include?: unknown
  root?: string
  /** Where the app's TypeScript transform sits relative to this plugin. */
  typescriptFirst?: boolean
  /** An app applies its TypeScript transform to TypeScript files only. */
  typescript?: boolean
}

function compile(code: string, filename: string, options: CompileOptions = {}): string {
  const harnessed: PluginItem =
    options.include === undefined ? HARNESSED : [HARNESSED, { include: options.include }]
  const typescript: PluginItem = [
    require.resolve('@babel/plugin-transform-typescript'),
    // The Ember blueprint's setting: only `import type` is elided.
    { allowDeclareFields: true, onlyRemoveTypeImports: true },
  ]
  const result = transformSync(code, {
    filename,
    root: options.root ?? ROOT,
    babelrc: false,
    configFile: false,
    plugins: [
      ...(options.typescriptFirst ? [typescript, harnessed] : [harnessed]),
      ...(options.pipeline ?? CLASSIC),
      ...(options.typescriptFirst || options.typescript === false ? [] : [typescript]),
      require.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  })
  if (result?.code == null) throw new Error(`no output for ${filename}`)
  return result.code
}

/** Runs CommonJS output with a tiny module table, returning its exports. */
function run(code: string, modules: Record<string, unknown> = {}): Record<string, unknown> {
  const exports: Record<string, unknown> = {}
  const localRequire = (id: string): unknown => {
    if (id in modules) return modules[id]
    return require(id)
  }
  runInNewContext(code, { exports, module: { exports }, require: localRequire, Symbol, Object })
  return exports
}

const legacyApp = `
  function tracked(target: object, key: string, descriptor?: PropertyDescriptor): any {
    calls.push([typeof target, key, typeof descriptor])
    return { configurable: true, enumerable: true, get() { return 'tracked:' + key } }
  }
  export const calls: unknown[] = []
  export class Counter {
    @tracked count = 0
  }
`

const harness = `
  function ByLabel(label: string) {
    return function (_value: unknown, context: ClassAccessorDecoratorContext) {
      return { get(this: unknown) { return 'query:' + label + ':' + String(context.name) } }
    }
  }
  export class DecoratedFields {
    @ByLabel('Email') private accessor email!: string
    read(): string { return this.email }
  }
`

/** The library's real shape: an imported class decorator, imported field decorators, type imports. */
const realisticHarness = `
  import { Harness, ByLabel, testId } from 'decorators'
  import type { Query } from 'types-only'
  import { type Selector } from 'types-only'

  @Harness({ host: testId('login-form') })
  export class LoginForm {
    @ByLabel('Email') private accessor email!: Query
    declare readonly kind: string
    note!: string
    read(): string { return String(this.email) }
    static hostOf(): Selector { return (LoginForm as unknown as { host: Selector }).host }
  }
`

const decoratorsModule = {
  Harness: (options: { host: string }) => (value: { host?: string }) => {
    value.host = options.host
  },
  ByLabel: (label: string) => () => ({
    get() {
      return 'query:' + label
    },
  }),
  testId: (id: string) => 'testId:' + id,
}

describe('@harnessed-ts/core/babel', () => {
  for (const [name, pipeline] of Object.entries(LEGACY_PIPELINES)) {
    describe(name, () => {
      it('lowers standard decorators and accessor in a harness file', () => {
        const code = compile(harness, '/app/tests/harness/login-form.harness.ts', { pipeline })
        expect(code).not.toMatch(/\baccessor\s+email/)
        const { DecoratedFields } = run(code) as {
          DecoratedFields: new () => { read(): string }
        }
        expect(new DecoratedFields().read()).toBe('query:Email:email')
      })

      it('leaves app code to the legacy transform', () => {
        const code = compile(legacyApp, '/app/components/counter.ts', { pipeline })
        const runtime = name.startsWith('decorator-transforms')
          ? { 'decorator-transforms/runtime': require('decorator-transforms/runtime') }
          : {}
        const { Counter, calls } = run(code, runtime) as {
          Counter: new () => { count: unknown }
          calls: unknown[]
        }
        expect(new Counter().count).toBe('tracked:count')
        expect(calls).toEqual([['object', 'count', 'object']])
      })

      it('compiles a realistic harness: class decorator, imports, `!` and `declare` fields', () => {
        const code = compile(realisticHarness, '/app/tests/harness/login-form.ts', { pipeline })
        // Imports used only as types are gone; decorator imports are kept.
        expect(code).not.toMatch(/types-only/)
        expect(code).toMatch(/require\("decorators"\)/)
        const { LoginForm } = run(code, { decorators: decoratorsModule }) as {
          LoginForm: (new () => { read(): string }) & { hostOf(): string }
        }
        expect(LoginForm.hostOf()).toBe('testId:login-form')
        expect(new LoginForm().read()).toBe('query:Email')
      })
    })
  }

  it('matches harness files by default: *.harness, *.page, and harness directories', () => {
    for (const filename of [
      '/app/tests/login.harness.ts',
      '/app/tests/checkout.page.ts',
      '/app/tests/checkout.page.gts',
      '/app/tests/harness/anything.ts',
      '/app/tests/harnesses/pages/wizard.ts',
    ]) {
      expect(compile(harness, filename), filename).not.toMatch(/\baccessor\s+email/)
    }
  })

  it('sees through a query on the module id, as Vite and Vitest append one', () => {
    for (const filename of [
      '/app/tests/harness/login.harness.ts?import',
      '/app/tests/login.harness.ts?v=3f2a',
    ]) {
      const code = compile(realisticHarness, filename)
      expect(code, filename).not.toMatch(/\baccessor\s+email/)
      expect(code, filename).not.toMatch(/types-only/)
    }
  })

  it('matches against the root-relative path: a checkout under harness/ claims nothing', () => {
    // The app's own legacy code, in a repo that happens to live at /home/harness/.
    const root = '/home/harness/my-app'
    const code = compile(legacyApp, `${root}/components/counter.ts`, { root })
    const { Counter } = run(code) as { Counter: new () => { count: unknown } }
    expect(new Counter().count).toBe('tracked:count')
  })

  it('takes include patterns — RegExp or string — and leaves other files alone', () => {
    for (const include of [[/^tests\/pages\//], ['tests/pages/']]) {
      const code = compile(harness, '/app/tests/pages/login.ts', { include })
      expect(code).not.toMatch(/\baccessor\s+email/)
      // With include narrowed, a file outside it is not touched by this plugin —
      // so the legacy transform rejects `accessor`, which is the signal that the
      // boundary held.
      expect(() => compile(harness, '/app/tests/harness/login.harness.ts', { include })).toThrow()
    }
  })

  it('compiles a .jsx harness without treating it as TypeScript', () => {
    const jsx = `
      function Dec() { return () => ({ get() { return 'ok' } }) }
      export class Fields {
        @Dec() accessor value
        render() { return <div /> }
        read() { return this.value }
      }
    `
    const code = compile(jsx, '/app/tests/harness/fields.jsx', {
      pipeline: [...CLASSIC, require.resolve('@babel/plugin-transform-react-jsx')],
      typescript: false,
    })
    expect(code).not.toMatch(/\baccessor\s+value/)
  })

  it('does not depend on where the app lists its TypeScript transform', () => {
    // The claimed file is stripped of its types in the isolated pass, so the
    // app's TypeScript plugin has nothing left to elide either way round.
    const code = compile(realisticHarness, '/app/tests/harness/login-form.ts', {
      typescriptFirst: true,
    })
    expect(code).not.toMatch(/types-only/)
    expect(code).not.toMatch(/\baccessor\s+email/)
  })
})
