/// <reference types="node" />
import { createRequire } from 'node:module'

/**
 * A Babel plugin that lowers TC39 standard (2023-11) decorators and `accessor`
 * fields in harness files only.
 *
 * Ember apps compile their own decorators — `@tracked`, `@service`, `@action` —
 * with the legacy transform (ember-cli-babel's proposal plugin in legacy mode, or
 * decorator-transforms under Embroider), and cannot switch, because those
 * decorators only implement the legacy protocol. Harnesses need the standard one.
 * So this plugin claims the files that hold harnesses, lowers them completely
 * before anything else sees them, and leaves every other file to the app's own
 * pipeline.
 *
 * Put it first in the plugin list:
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
 * Needs `@babel/plugin-proposal-decorators`, `@babel/plugin-syntax-typescript` and
 * `@babel/plugin-transform-class-static-block` installed alongside it. The app's own TypeScript transform still strips types
 * afterwards.
 */

export interface BabelPluginOptions {
  /**
   * Which files hold harnesses. Each is tested against the file's absolute path,
   * with backslashes normalised to `/`. Defaults to `*.harness.*` and `*.page.*`
   * files, and anything under a `harness/` or `harnesses/` directory.
   */
  include?: RegExp[]
}

export const DEFAULT_INCLUDE: readonly RegExp[] = [
  /\.(harness|page)\.[cm]?[jt]sx?$/,
  /\/harness(es)?\//,
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

interface PluginState {
  filename?: string
  file: { code: string }
}

interface BabelPlugin {
  name: string
  manipulateOptions(options: { filename?: string }, parserOptions: { plugins: unknown[] }): void
  visitor: { Program: { enter(path: ProgramPath, state: PluginState): void } }
}

/** Resolves the optional peers from where core is installed, not from Babel's cwd. */
const requireFromHere = createRequire(import.meta.url)

function load(id: string): unknown {
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
const MAY_HAVE_DECORATORS = /\baccessor\s|@[A-Za-z_$]/

export default function harnessedBabel(
  api: BabelApi,
  options: BabelPluginOptions = {},
): BabelPlugin {
  const include = options.include ?? DEFAULT_INCLUDE
  const claims = (filename: string | undefined): filename is string =>
    filename !== undefined && include.some(pattern => pattern.test(filename.replace(/\\/g, '/')))
  let decorators: unknown
  let typescript: unknown
  let staticBlocks: unknown

  return {
    name: 'harnessed:decorators',

    // The app's parser is configured for legacy decorators, which cannot parse
    // `accessor`. Enabling it for claimed files only gets them as far as the
    // visitor below; nothing else in the app sees new syntax.
    manipulateOptions(babelOptions, parserOptions) {
      if (claims(babelOptions.filename)) parserOptions.plugins.push('decoratorAutoAccessors')
    },

    visitor: {
      Program: {
        enter(path, state) {
          const filename = state.filename
          if (!claims(filename)) return
          if (!MAY_HAVE_DECORATORS.test(state.file.code)) return

          decorators ??= load('@babel/plugin-proposal-decorators')
          typescript ??= load('@babel/plugin-syntax-typescript')
          staticBlocks ??= load('@babel/plugin-transform-class-static-block')

          // A separate, fully isolated pass over the original source: no config
          // files, no presets, just the standard transform. Its helpers are
          // inlined, so the result needs no runtime import.
          const result = api.transformSync(state.file.code, {
            filename,
            babelrc: false,
            configFile: false,
            ast: true,
            code: false,
            sourceType: 'module',
            plugins: [
              [typescript, { isTSX: /\.[cm]?tsx$/.test(filename) }],
              [decorators, { version: '2023-11' }],
              // The decorators output initialises in a `static {}` block. An
              // Ember pipeline's class-properties plugin refuses those, so
              // lower them here into the static fields it does understand.
              staticBlocks,
            ],
          })
          const program = result?.ast?.program
          if (program == null) return

          // Swapped in before any later plugin's Program visitor runs, so the
          // legacy transform finds no decorators left, and the app's TypeScript
          // transform strips the types as usual.
          path.node.body = program.body
          path.node.directives = program.directives
          path.scope.crawl()
        },
      },
    },
  }
}
