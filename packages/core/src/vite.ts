/**
 * A Vite plugin that lowers TC39 standard decorators and `accessor` fields.
 *
 * Needed because neither Node nor any browser can parse `accessor`, and Vite's
 * default transform leaves it in place: at `esnext` nothing is lowered, and Vite 8
 * does not lower it at a lower target either. esbuild lowers both, but only when
 * its own target is at or below es2022.
 *
 * Put it first in the plugin list so it runs before the framework plugin.
 *
 * ```ts
 * import { harnessedDecorators } from '@harnessed-ts/core/vite'
 *
 * export default defineConfig({
 *   plugins: [harnessedDecorators(), react()],
 * })
 * ```
 */

export interface DecoratorPluginOptions {
  /** Files to transform. Defaults to every `.ts` and `.tsx`. */
  include?: RegExp
  /** esbuild target. Must be at or below `es2022` for lowering to happen. */
  target?: string
}

/**
 * Structurally compatible with Vite's `Plugin` without importing Vite, so core
 * stays dependency-free. `map` is a string because that is what esbuild returns,
 * and Vite's `SourceMapInput` accepts one — typing it looser makes the plugin
 * unassignable to `Plugin`.
 */
interface MinimalPlugin {
  name: string
  enforce: 'pre'
  transform(code: string, id: string): Promise<{ code: string; map: string } | null> | null
}

interface EsbuildModule {
  transform(code: string, options: Record<string, unknown>): Promise<{ code: string; map: string }>
}

export function harnessedDecorators(options: DecoratorPluginOptions = {}): MinimalPlugin {
  const include = options.include ?? /\.tsx?($|\?)/
  const target = options.target ?? 'es2022'
  let esbuild: EsbuildModule | undefined

  return {
    name: 'harnessed:decorators',
    enforce: 'pre',
    async transform(code: string, id: string) {
      if (!include.test(id)) return null
      // Cheap bail-out: most files have neither.
      if (!/\baccessor\s|@[A-Za-z_$]/.test(code)) return null

      if (esbuild === undefined) {
        try {
          esbuild = (await import('esbuild')) as unknown as EsbuildModule
        } catch (cause) {
          throw new Error(
            'harnessed: harnessedDecorators() needs esbuild, which could not be imported. ' +
              'Install it as a devDependency (`npm i -D esbuild`).',
            { cause },
          )
        }
      }

      const result = await esbuild.transform(code, {
        loader: id.includes('.tsx') ? 'tsx' : 'ts',
        target,
        // Leave JSX for the framework plugin that follows.
        jsx: 'preserve',
        sourcefile: id,
        sourcemap: true,
        tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, target: 'ES2022' } },
      })
      return { code: result.code, map: result.map }
    },
  }
}
