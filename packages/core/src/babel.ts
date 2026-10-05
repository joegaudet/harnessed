/// <reference types="node" />
import { createRequire } from 'node:module'
import { relative } from 'node:path'

/**
 * A Babel plugin that lowers TC39 standard (2023-11) decorators and `accessor`
 * fields in harness files only.
 *
 * Ember apps compile their own decorators — `@tracked`, `@service`, `@action` —
 * with the legacy transform (ember-cli-babel's proposal plugin in legacy mode, or
 * decorator-transforms under Embroider), and cannot switch, because those
 * decorators only implement the legacy protocol. Harnesses need the standard one.
 * So this plugin claims the files that hold harnesses, compiles them completely —
 * TypeScript stripped, decorators lowered — before anything else sees them, and
 * leaves every other file to the app's own pipeline.
 *
 * List it first, before the app's decorator plugins. Its work happens in
 * `Program.enter`, before Babel descends into any class, so the legacy transform
 * only ever sees the lowered output.
 *
 * ```js
 * // babel.config.cjs (Embroider + Vite)
 * plugins: [
 *   require.resolve('@harnessed-ts/core/babel'),
 *   // …the blueprint's own plugins, decorator-transforms among them
 * ]
 *
 * // ember-cli-build.js (classic)
 * babel: { plugins: [require.resolve('@harnessed-ts/core/babel')] }
 * ```
 *
 * It parses the files it claims itself (`parserOverride`), and Babel lets only
 * one plugin in a pipeline do that; no Ember build pipeline uses another.
 *
 * Needs, alongside it, Babel 7.24 or later (7.24 introduced the 2023-11
 * decorators version): `@babel/plugin-proposal-decorators`,
 * `@babel/plugin-transform-typescript`, `@babel/plugin-transform-class-static-block`,
 * and for `.jsx`/`.tsx` harnesses `@babel/plugin-syntax-jsx`.
 */

export interface BabelPluginOptions {
  /**
   * Which files hold harnesses. Each pattern is tested against the file's path
   * relative to the Babel root (or cwd), with `/` separators — so a checkout that
   * itself sits under a directory called `harness/` does not claim the whole app.
   * A string matches as a substring; a RegExp is tested. Strings survive the
   * option serialisation some build caches apply, which a RegExp does not.
   *
   * Defaults to `*.harness.*` and `*.page.*` files, and anything under a
   * `harness/` or `harnesses/` directory. If your app's own legacy-decorated
   * files use one of those names (a `*.page.tsx` route component, say), pass
   * `include` explicitly.
   */
  include?: ReadonlyArray<RegExp | string>
}

const DEFAULT_INCLUDE: readonly RegExp[] = [
  /\.(harness|page)\.([cm]?[jt]sx?|g[jt]s)$/,
  /(^|\/)harness(es)?\//,
]

/** The structural slice of Babel this plugin uses, so core stays dependency-free. */
interface BabelApi {
  transformSync(
    code: string,
    options: Record<string, unknown>,
  ): { ast?: { program: BabelNode } | null } | null
}

interface BabelNode {
  body: unknown[]
  directives: unknown[]
}

interface ProgramPath {
  node: BabelNode
  scope: { crawl(): void }
}

interface FileOptions {
  filename?: string | null
  root?: string
  cwd?: string
}

interface PluginState {
  filename?: string
  file: { code: string; opts: FileOptions }
}

type ParserPlugin = string | [string, Record<string, unknown>]

interface ParserOptions {
  plugins?: ParserPlugin[]
  sourceFileName?: string
}

interface BabelPlugin {
  name: string
  manipulateOptions(options: FileOptions, parserOptions: ParserOptions): void
  parserOverride(
    code: string,
    parserOptions: ParserOptions,
    parse: (code: string, options: ParserOptions) => unknown,
  ): unknown
  visitor: { Program: { enter(path: ProgramPath, state: PluginState): void } }
}

const DECORATOR_SYNTAX = new Set(['decorators', 'decorators-legacy', 'decoratorAutoAccessors'])

function pluginName(plugin: ParserPlugin): string {
  return typeof plugin === 'string' ? plugin : plugin[0]
}

declare const __filename: string | undefined

let requireFromHere: NodeJS.Require | undefined

/**
 * Resolves the optional peers from where core is installed, not from Babel's
 * cwd. Created lazily, and from `__filename` in the CJS build Babel loads: an
 * `import.meta` shim evaluated at load breaks under a jsdom-style `document`.
 */
function load(id: string): unknown {
  requireFromHere ??= createRequire(typeof __filename === 'string' ? __filename : import.meta.url)
  try {
    const loaded = requireFromHere(id) as { default?: unknown }
    return loaded.default ?? loaded
  } catch (cause) {
    throw new Error(
      `harnessed: @harnessed-ts/core/babel needs ${id}, which could not be loaded. ` +
        `Install it as a devDependency (\`npm i -D ${id}\`).`,
      { cause },
    )
  }
}

/** Cheap bail-out: most files in a harness directory still have neither. */
const MAY_HAVE_DECORATORS = /\baccessor\s|@[A-Za-z_$(]/

const TYPESCRIPT = /\.([cm]?ts|tsx|gts)$/
const JSX = /\.[jt]sx$/

/**
 * The file's path without the query Vite and Vitest append to module ids
 * (`?import`, `?v=…`): every check here is about the file, and a query would
 * hide its extension.
 */
function pathOf(filename: string): string {
  const query = filename.indexOf('?')
  return query === -1 ? filename : filename.slice(0, query)
}

/** The path the include patterns see: relative to the Babel root, `/`-separated. */
function relativePath(options: FileOptions): string | undefined {
  if (options.filename == null) return undefined
  const root = options.root ?? options.cwd ?? process.cwd()
  return relative(root, pathOf(options.filename)).replace(/\\/g, '/')
}

export default function harnessedBabel(
  api: BabelApi,
  options: BabelPluginOptions = {},
): BabelPlugin {
  const include = options.include ?? DEFAULT_INCLUDE
  // Filenames claimed in manipulateOptions, where the Babel root is known, for
  // parserOverride, which only sees the file's name.
  const claimed = new Set<string>()
  const claims = (fileOptions: FileOptions): boolean => {
    const path = relativePath(fileOptions)
    if (path === undefined) return false
    return include.some(pattern =>
      typeof pattern === 'string' ? path.includes(pattern) : pattern.test(path),
    )
  }

  return {
    name: 'harnessed:decorators',

    manipulateOptions(babelOptions) {
      if (babelOptions.filename != null && claims(babelOptions)) claimed.add(babelOptions.filename)
    },

    // The app's parser is configured for legacy decorators, which can parse
    // neither `accessor` nor a decorator after `export` — the form Vite writes
    // once it has stripped the types. A claimed file is parsed with standard
    // decorator syntax instead; the visitor below then compiles it. Nothing
    // else in the app sees the different parser.
    parserOverride(code, parserOptions, parse) {
      const filename = parserOptions.sourceFileName
      if (filename === undefined || !claimed.has(filename)) return undefined
      const plugins = (parserOptions.plugins ?? []).filter(
        plugin => !DECORATOR_SYNTAX.has(pluginName(plugin)),
      )
      return parse(code, {
        ...parserOptions,
        plugins: [...plugins, ['decorators', {}], 'decoratorAutoAccessors'],
      })
    },

    visitor: {
      Program: {
        enter(path, state) {
          const filename = state.filename
          if (filename === undefined || !claims(state.file.opts)) return
          if (!MAY_HAVE_DECORATORS.test(state.file.code)) return

          const typescript = TYPESCRIPT.test(pathOf(filename))
          const jsx = JSX.test(pathOf(filename))
          const plugins: unknown[] = []
          // Stripped here, not by the app's transform afterwards: the lowering
          // moves initialisers onto `!` and `declare` fields, which TypeScript
          // syntax then forbids.
          if (typescript) {
            plugins.push([
              load('@babel/plugin-transform-typescript'),
              { allowDeclareFields: true, isTSX: jsx },
            ])
          } else if (jsx) {
            plugins.push(load('@babel/plugin-syntax-jsx'))
          }
          plugins.push(
            [load('@babel/plugin-proposal-decorators'), { version: '2023-11' }],
            // The decorators output initialises in a `static {}` block. An Ember
            // pipeline's class-properties plugin refuses those, so lower them
            // here into the static fields it does understand.
            load('@babel/plugin-transform-class-static-block'),
          )

          // A separate, fully isolated pass over the original source: no config
          // files, no presets. Its helpers are inlined, so the result needs no
          // runtime import. Locations still point into the original source, so
          // the app's source maps stay right.
          const result = api.transformSync(state.file.code, {
            filename,
            babelrc: false,
            configFile: false,
            ast: true,
            code: false,
            sourceType: 'module',
            plugins,
          })
          const program = result?.ast?.program
          if (program == null) return

          // Swapped in before any later plugin's Program visitor runs, so the
          // legacy transform finds no decorators left.
          path.node.body = program.body
          path.node.directives = program.directives
          path.scope.crawl()
        },
      },
    },
  }
}
