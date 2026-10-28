/**
 * Loads harness files under `bun test` with TC39 standard decorators, whatever
 * the project's tsconfig says. Preload it:
 *
 * ```toml
 * # bunfig.toml
 * [test]
 * preload = ["@harnessed-ts/core/bun"]
 * ```
 *
 * Bun compiles decorators itself, but follows `experimentalDecorators` in the
 * nearest tsconfig — and a project that sets it for its own code (Angular,
 * legacy MobX) would get the legacy protocol in its harnesses too, which they
 * cannot run under. This plugin claims every TypeScript file outside
 * `node_modules` that uses `accessor` or a decorator, and lowers it with esbuild
 * to plain JavaScript first, so Bun never has to choose.
 *
 * Needs `esbuild` installed alongside, as `harnessedDecorators()` does.
 */

interface OnLoadArgs {
  path: string
}
interface PluginBuilder {
  onLoad(
    options: { filter: RegExp },
    callback: (args: OnLoadArgs) => Promise<{ contents: string; loader: string } | undefined>,
  ): void
}
export interface BunPlugin {
  name: string
  setup(build: PluginBuilder): void
}

interface EsbuildModule {
  transform(code: string, options: Record<string, unknown>): Promise<{ code: string }>
}
interface BunGlobal {
  plugin(plugin: BunPlugin): void
  file(path: string): { text(): Promise<string> }
}

export interface BunPluginOptions {
  /** Files to consider. Defaults to every `.ts`, `.tsx`, `.mts` and `.cts` outside `node_modules`. */
  include?: RegExp
}

const DEFAULT_INCLUDE = /^(?!.*[\\/]node_modules[\\/]).*\.[mc]?tsx?$/

/** The plugin itself, for a preload of your own that registers it with other options. */
export function harnessedBunPlugin(options: BunPluginOptions = {}): BunPlugin {
  const include = options.include ?? DEFAULT_INCLUDE
  const bun = (globalThis as { Bun?: BunGlobal }).Bun
  let esbuild: EsbuildModule | undefined
  return {
    name: 'harnessed:decorators',
    setup(build) {
      build.onLoad({ filter: include }, async ({ path }) => {
        if (bun === undefined) return undefined
        const code = await bun.file(path).text()
        // Cheap bail-out: most files have neither, and Bun handles them natively.
        if (!/\baccessor\s|@[A-Za-z_$]/.test(code)) return undefined
        if (esbuild === undefined) {
          try {
            esbuild = (await import('esbuild')) as unknown as EsbuildModule
          } catch (cause) {
            throw new Error(
              'harnessed: @harnessed-ts/core/bun needs esbuild, which could not be imported. ' +
                'Install it as a devDependency (`bun add -d esbuild`).',
              { cause },
            )
          }
        }
        const result = await esbuild.transform(code, {
          loader: path.endsWith('x') ? 'tsx' : 'ts',
          format: 'esm',
          target: 'es2022',
          jsx: 'automatic',
          sourcefile: path,
          sourcemap: 'inline',
          tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, target: 'ES2022' } },
        })
        return { contents: result.code, loader: 'js' }
      })
    },
  }
}

const bun = (globalThis as { Bun?: BunGlobal }).Bun
if (bun === undefined) {
  throw new Error(
    'harnessed: @harnessed-ts/core/bun is a Bun preload. Under Node, use ' +
      '`node --import @harnessed-ts/core/register`; under Vite, `harnessedDecorators()`.',
  )
}
bun.plugin(harnessedBunPlugin())
