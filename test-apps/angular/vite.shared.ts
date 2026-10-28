import angular from '@analogjs/vite-plugin-angular'
import { harnessedDecorators } from '@harnessed-ts/core/vite'
import type { PluginOption } from 'vite'

/**
 * The decorator boundary. Angular's components compile with the legacy
 * `experimentalDecorators` transform; harnesses and pages use standard
 * decorators and `accessor` fields. The file name is what decides which a file
 * gets, so both plugins are told the same thing:
 */
export const HARNESS_FILES = /\.(harness|page)\.ts$/

/**
 * `harnessedDecorators()` lowers harness and page files, and comes first, so
 * it runs before the Angular plugin. The Angular plugin then leaves them alone:
 * it emits each file from its own TypeScript program rather than from the code
 * it is handed, so without `transformFilter` it would replace the lowered
 * harness with a legacy-decorator build of it.
 */
export function plugins(tsconfig: string): PluginOption[] {
  return [
    harnessedDecorators({ include: HARNESS_FILES }),
    angular({
      tsconfig,
      // Ahead-of-time in tests as well as in the build, so the code under test
      // is the code that ships.
      jit: false,
      transformFilter: (_code, id) => !HARNESS_FILES.test(id),
    }),
  ]
}
