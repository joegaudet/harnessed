import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transformSync } from '@babel/core'
import type { PluginItem } from '@babel/core'
import { describe, expect, it } from 'vitest'
import harnessedBabel from '../src/babel'

/**
 * An Ember app compiles its own decorators — `@tracked`, `@service`, `@action`
 * — with the legacy transform, and cannot switch: those decorators only
 * implement the legacy protocol. A harness needs the standard (2023-11) one and
 * `accessor`. These compile both kinds of file through one Babel pipeline set up
 * the way each Ember build sets it up, then run the output and check each file
 * got the semantics it was written for.
 */
const require = createRequire(import.meta.url)

const LEGACY_PIPELINES: Record<string, PluginItem[]> = {
  // ember-cli-babel (classic builds): the proposal plugin in legacy mode.
  'ember-cli-babel (legacy proposal)': [
    [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
    [require.resolve('@babel/plugin-transform-class-properties'), { loose: true }],
  ],
  // The Ember 6 / Embroider blueprint: ef4's decorator-transforms.
  'decorator-transforms (Embroider + Vite)': [
    [
      require.resolve('decorator-transforms'),
      { runtime: { import: 'decorator-transforms/runtime' } },
    ],
  ],
}

function compile(
  code: string,
  filename: string,
  pipeline: PluginItem[],
  include?: unknown,
): string {
  const result = transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [
      // First, as the setup docs say: it must see the file before anything
      // else lowers decorators.
      include === undefined ? harnessedBabel : [harnessedBabel, { include }],
      ...pipeline,
      [require.resolve('@babel/plugin-transform-typescript'), { allowDeclareFields: true }],
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

describe('@harnessed-ts/core/babel', () => {
  for (const [name, pipeline] of Object.entries(LEGACY_PIPELINES)) {
    describe(name, () => {
      it('lowers standard decorators and accessor in a harness file', () => {
        const code = compile(harness, '/app/tests/harness/login-form.harness.ts', pipeline)
        expect(code).not.toMatch(/\baccessor\s+email/)
        const { DecoratedFields } = run(code) as { DecoratedFields: new () => { read(): string } }
        expect(new DecoratedFields().read()).toBe('query:Email:email')
      })

      it('leaves app code to the legacy transform', () => {
        const code = compile(legacyApp, '/app/components/counter.ts', pipeline)
        const runtime = name.startsWith('decorator-transforms')
          ? { 'decorator-transforms/runtime': require('decorator-transforms/runtime') }
          : {}
        const { Counter, calls } = run(code, runtime) as {
          Counter: new () => { count: unknown }
          calls: unknown[]
        }
        expect((new Counter() as { count: unknown }).count).toBe('tracked:count')
        expect(calls).toEqual([['object', 'count', 'object']])
      })
    })
  }

  it('matches harness files by default: *.harness, *.page, and harness directories', () => {
    const pipeline = LEGACY_PIPELINES['ember-cli-babel (legacy proposal)']!
    for (const filename of [
      '/app/tests/login.harness.ts',
      '/app/tests/checkout.page.ts',
      '/app/tests/harness/anything.ts',
      '/app/tests/harnesses/pages/wizard.ts',
    ]) {
      expect(compile(harness, filename, pipeline), filename).not.toMatch(/\baccessor\s+email/)
    }
  })

  it('takes include patterns, and then leaves non-matching files alone', () => {
    const pipeline = LEGACY_PIPELINES['ember-cli-babel (legacy proposal)']!
    const code = compile(harness, '/app/tests/pages/login.ts', pipeline, [/\/tests\/pages\//])
    expect(code).not.toMatch(/\baccessor\s+email/)
    // With include narrowed, a file outside it is not touched by this plugin —
    // so the legacy transform rejects `accessor`, which is the signal that the
    // boundary held.
    expect(() =>
      compile(harness, '/app/tests/harness/login.harness.ts', pipeline, [/\/tests\/pages\//]),
    ).toThrow()
  })
})
